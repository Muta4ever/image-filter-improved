import { describe, it, expect } from "vitest";
import {
  computeMetrics,
  applyFilter,
  gaussianBlur,
  medianFilter,
  invert,
  type FilterType,
} from "./imageProcessing";

const W = 64;
const H = 64;

/** Build a W×H RGBA buffer from a per-pixel color function. */
function makeImage(
  fn: (x: number, y: number) => [number, number, number],
): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const [r, g, b] = fn(x, y);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  return d;
}

/** Mean absolute per-pixel difference on the red channel. */
function meanDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]);
  return s / (a.length / 4);
}

const flat = makeImage(() => [128, 128, 128]);
const checker = makeImage((x, y) =>
  ((x >> 2) + (y >> 2)) % 2 ? [240, 240, 240] : [10, 10, 10],
);

// Deterministic salt-and-pepper noise (no Math.random in tests).
let seed = 1;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
// ~8% salt-and-pepper impulses over a gray field — the case a median filter
// is designed for (and sparse enough that the metric stays below its ceiling).
const noisy = makeImage(() => {
  const r = rnd();
  if (r < 0.04) return [0, 0, 0];
  if (r > 0.96) return [255, 255, 255];
  return [128, 128, 128];
});

describe("computeMetrics", () => {
  it("measures a flat gray field as mid exposure, no contrast, no edges", () => {
    const m = computeMetrics(flat, W, H);
    expect(m.exposure).toBeCloseTo(128, 0);
    expect(m.contrast).toBeLessThan(1);
    expect(m.edgeDefinition).toBeLessThan(5);
    expect(m.softness).toBeGreaterThan(95);
  });

  it("reports more edges for a sharp checkerboard than a flat field", () => {
    const sharp = computeMetrics(checker, W, H);
    const dull = computeMetrics(flat, W, H);
    expect(sharp.edgeDefinition).toBeGreaterThan(dull.edgeDefinition);
  });

  it("reports more artifacts for a noisy image than a flat field", () => {
    const n = computeMetrics(noisy, W, H);
    const f = computeMetrics(flat, W, H);
    expect(n.artifactLevel).toBeGreaterThan(f.artifactLevel);
  });

  it("keeps normalized metrics within 0–100 and never NaN", () => {
    for (const m of [flat, checker, noisy].map((d) => computeMetrics(d, W, H))) {
      for (const v of Object.values(m)) expect(Number.isNaN(v)).toBe(false);
      expect(m.artifactLevel).toBeGreaterThanOrEqual(0);
      expect(m.artifactLevel).toBeLessThanOrEqual(100);
      expect(m.edgeDefinition).toBeGreaterThanOrEqual(0);
      expect(m.edgeDefinition).toBeLessThanOrEqual(100);
      expect(m.tissueSaturation).toBeGreaterThanOrEqual(0);
      expect(m.tissueSaturation).toBeLessThanOrEqual(100);
    }
  });
});

describe("filters", () => {
  it("every filter returns a same-sized buffer with no NaN", () => {
    const filters: FilterType[] = [
      "smoothing",
      "artifact",
      "edge",
      "invert",
      "contrast",
    ];
    for (const f of filters) {
      const out = applyFilter(f, 80, checker, W, H);
      expect(out.length).toBe(checker.length);
      expect(Array.from(out).some((v) => Number.isNaN(v))).toBe(false);
    }
  });

  it("gaussian blur reduces edge energy on a checkerboard", () => {
    const blurred = gaussianBlur(checker, W, H, 3);
    expect(computeMetrics(blurred, W, H).edgeDefinition).toBeLessThan(
      computeMetrics(checker, W, H).edgeDefinition,
    );
  });

  it("median filter reduces measured noise on a noisy image", () => {
    const cleaned = medianFilter(noisy, W, H);
    expect(computeMetrics(cleaned, W, H).artifactLevel).toBeLessThan(
      computeMetrics(noisy, W, H).artifactLevel,
    );
  });

  it("full inversion maps a bright pixel to a dark one and back", () => {
    const inv = invert(checker, 1);
    // checker[0] is the dark corner (10); its inverse should be bright (~245)
    expect(inv[0]).toBeGreaterThan(200);
  });

  it("intensity 0 is a no-op (returns the source unchanged)", () => {
    expect(meanDiff(applyFilter("smoothing", 0, checker, W, H), checker)).toBe(0);
    expect(meanDiff(applyFilter("contrast", 0, checker, W, H), checker)).toBe(0);
  });
});
