/**
 * Real image-processing primitives operating on raw RGBA pixel buffers
 * (the `data` field of an HTML5 Canvas `ImageData`).
 *
 * Everything here is pure and dependency-free so it can run unchanged on the
 * main thread or inside a Web Worker. No CSS filters, no random numbers — the
 * metrics are measured from the actual pixels and the filters are genuine
 * spatial-domain operations (separable Gaussian, median, unsharp mask,
 * percentile contrast stretch, inversion).
 */

export type FilterType =
  | "smoothing"
  | "artifact"
  | "edge"
  | "invert"
  | "contrast";

export interface ImageMetrics {
  /** Inverse of edge definition (0 sharp – 100 blurry). */
  softness: number;
  /** Mean luminance, 0–255. Low = underexposed, high = overexposed. */
  exposure: number;
  /** Std. deviation of luminance — global contrast. */
  contrast: number;
  /** Noise estimate (Immerkær Laplacian), normalized 0–100. */
  artifactLevel: number;
  /** Mean Sobel gradient magnitude, normalized 0–100. */
  edgeDefinition: number;
  /** Mean HSV saturation, 0–100. */
  tissueSaturation: number;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const clamp100 = (v: number) => (v < 0 ? 0 : v > 100 ? 100 : v);

// Calibration constants mapping raw measurements onto a 0–100 display scale.
const NOISE_SCALE = 6; // Laplacian sigma -> %
const EDGE_SCALE = 1.2; // mean Sobel magnitude -> %

/** Rec. 601 luminance plane from an RGBA buffer. */
function luminancePlane(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const n = width * height;
  const lum = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return lum;
}

/**
 * Measure diagnostic-style metrics directly from the pixels:
 * exposure (mean luminance), contrast (std dev), saturation (HSV),
 * noise (Immerkær's fast Laplacian estimator) and edge definition
 * (mean Sobel gradient magnitude).
 */
export function computeMetrics(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ImageMetrics {
  const n = width * height;
  const lum = luminancePlane(data, width, height);

  // First-order statistics: mean (exposure), variance (contrast), saturation.
  let sum = 0;
  let satSum = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    sum += lum[i];
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
  }
  const mean = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = lum[i] - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / n);
  const saturation = (satSum / n) * 100;

  // Second-order statistics over the interior: noise + edges in one pass.
  let lapSum = 0; // sum |Laplacian| for noise estimation
  let gradSum = 0; // sum Sobel magnitude for edge definition
  let interior = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = lum[i - width - 1];
      const tc = lum[i - width];
      const tr = lum[i - width + 1];
      const ml = lum[i - 1];
      const mc = lum[i];
      const mr = lum[i + 1];
      const bl = lum[i + width - 1];
      const bc = lum[i + width];
      const br = lum[i + width + 1];

      // Immerkær Laplacian mask [[1,-2,1],[-2,4,-2],[1,-2,1]]
      const lap =
        tl - 2 * tc + tr - 2 * ml + 4 * mc - 2 * mr + bl - 2 * bc + br;
      lapSum += Math.abs(lap);

      // Sobel gradient
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
      gradSum += Math.sqrt(gx * gx + gy * gy);

      interior++;
    }
  }

  const sigma =
    interior > 0
      ? Math.sqrt(Math.PI / 2) * (lapSum / (6 * interior))
      : 0;
  const meanGrad = interior > 0 ? gradSum / interior : 0;

  const edgeDefinition = clamp100(meanGrad * EDGE_SCALE);

  return {
    exposure: mean,
    contrast: std,
    tissueSaturation: clamp100(saturation),
    artifactLevel: clamp100(sigma * NOISE_SCALE),
    edgeDefinition,
    softness: clamp100(100 - edgeDefinition),
  };
}

/** Normalized 1-D Gaussian kernel for a given sigma. */
function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const k = new Float32Array(size);
  const s2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / s2);
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) k[i] /= sum;
  return k;
}

/** Separable Gaussian blur (two 1-D passes), edges clamped. */
export function gaussianBlur(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number,
): Uint8ClampedArray {
  if (sigma <= 0) return src.slice();
  const k = gaussianKernel(sigma);
  const radius = (k.length - 1) / 2;
  const tmp = new Float32Array(src.length);
  const out = new Uint8ClampedArray(src.length);

  // Horizontal pass: src -> tmp
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let j = -radius; j <= radius; j++) {
        let xx = x + j;
        if (xx < 0) xx = 0;
        else if (xx >= width) xx = width - 1;
        const p = (y * width + xx) * 4;
        const w = k[j + radius];
        r += src[p] * w;
        g += src[p + 1] * w;
        b += src[p + 2] * w;
        a += src[p + 3] * w;
      }
      const o = (y * width + x) * 4;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
      tmp[o + 3] = a;
    }
  }

  // Vertical pass: tmp -> out
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let j = -radius; j <= radius; j++) {
        let yy = y + j;
        if (yy < 0) yy = 0;
        else if (yy >= height) yy = height - 1;
        const p = (yy * width + x) * 4;
        const w = k[j + radius];
        r += tmp[p] * w;
        g += tmp[p + 1] * w;
        b += tmp[p + 2] * w;
        a += tmp[p + 3] * w;
      }
      const o = (y * width + x) * 4;
      out[o] = clamp255(r);
      out[o + 1] = clamp255(g);
      out[o + 2] = clamp255(b);
      out[o + 3] = clamp255(a);
    }
  }
  return out;
}

/** 3×3 median filter per channel — removes salt-and-pepper noise. */
export function medianFilter(
  src: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const win = new Array<number>(9);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          let yy = y + dy;
          if (yy < 0) yy = 0;
          else if (yy >= height) yy = height - 1;
          for (let dx = -1; dx <= 1; dx++) {
            let xx = x + dx;
            if (xx < 0) xx = 0;
            else if (xx >= width) xx = width - 1;
            win[n++] = src[(yy * width + xx) * 4 + c];
          }
        }
        win.sort((a, b) => a - b);
        out[o + c] = win[4];
      }
      out[o + 3] = src[o + 3];
    }
  }
  return out;
}

/** Unsharp mask: src + amount·(src − blur). High-pass edge enhancement. */
export function unsharpMask(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): Uint8ClampedArray {
  const blurred = gaussianBlur(src, width, height, 1.6);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      out[i + c] = clamp255(src[i + c] + amount * (src[i + c] - blurred[i + c]));
    }
    out[i + 3] = src[i + 3];
  }
  return out;
}

/** Linear blend toward a full inversion (t in 0..1). */
export function invert(
  src: Uint8ClampedArray,
  t: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = clamp255(src[i] + t * (255 - 2 * src[i]));
    out[i + 1] = clamp255(src[i + 1] + t * (255 - 2 * src[i + 1]));
    out[i + 2] = clamp255(src[i + 2] + t * (255 - 2 * src[i + 2]));
    out[i + 3] = src[i + 3];
  }
  return out;
}

/**
 * Percentile contrast stretch: clip the luminance histogram at the 1st/99th
 * percentile and remap that range to [0,255] via a LUT, blended by `t`.
 */
export function contrastStretch(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  t: number,
): Uint8ClampedArray {
  const n = width * height;
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let l = (0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2]) | 0;
    if (l > 255) l = 255;
    hist[l]++;
  }

  const lowCount = n * 0.01;
  const highCount = n * 0.99;
  let acc = 0;
  let lo = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= lowCount) {
      lo = i;
      break;
    }
  }
  acc = 0;
  let hi = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= highCount) {
      hi = i;
      break;
    }
  }
  if (hi <= lo) {
    lo = 0;
    hi = 255;
  }

  const scale = 255 / (hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = clamp255((i - lo) * scale);

  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = clamp255(src[i] + t * (lut[src[i]] - src[i]));
    out[i + 1] = clamp255(src[i + 1] + t * (lut[src[i + 1]] - src[i + 1]));
    out[i + 2] = clamp255(src[i + 2] + t * (lut[src[i + 2]] - src[i + 2]));
    out[i + 3] = src[i + 3];
  }
  return out;
}

/** Linear per-pixel blend of a filtered result back toward the original. */
function blend(
  orig: Uint8ClampedArray,
  filt: Uint8ClampedArray,
  t: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(orig.length);
  for (let i = 0; i < orig.length; i += 4) {
    out[i] = orig[i] + t * (filt[i] - orig[i]);
    out[i + 1] = orig[i + 1] + t * (filt[i + 1] - orig[i + 1]);
    out[i + 2] = orig[i + 2] + t * (filt[i + 2] - orig[i + 2]);
    out[i + 3] = orig[i + 3];
  }
  return out;
}

/** Dispatch a filter at a given intensity (0–100) over an RGBA buffer. */
export function applyFilter(
  filter: FilterType,
  intensity: number,
  src: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  switch (filter) {
    case "smoothing":
      return gaussianBlur(src, width, height, t * 6);
    case "artifact":
      return blend(src, medianFilter(src, width, height), t);
    case "edge":
      return unsharpMask(src, width, height, t * 2.5);
    case "invert":
      return invert(src, t);
    case "contrast":
      return contrastStretch(src, width, height, t);
    default:
      return src.slice();
  }
}
