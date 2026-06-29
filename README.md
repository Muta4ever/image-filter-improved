# Clinical Image Enhancer

A React + TypeScript single-page application for medical-imaging workflows. It performs **real, pixel-level analysis** of clinical images (X-Rays, MRIs, CT scans), measures diagnostic-style metrics directly from the image data, recommends an appropriate enhancement via a transparent rule-based heuristic, and applies genuine **spatial-domain image-processing filters** — all client-side, with the heavy computation offloaded to a Web Worker so the UI never blocks.

This is a 100% frontend application with no backend: no image ever leaves the browser.

## Features

- **Clinical Image Upload**: Drag-and-drop interface for JPG and PNG medical scans.
- **Real Diagnostic Metrics**: Computed from the actual pixels via Canvas `ImageData` — not simulated:
  - **Exposure** — mean luminance (Rec. 601).
  - **Contrast** — standard deviation of luminance.
  - **Artifact Level** — noise estimate using Immerkær's fast Laplacian estimator.
  - **Edge Definition** — mean Sobel gradient magnitude.
  - **Softness** — inverse of edge definition.
  - **Tissue Saturation** — mean HSV saturation.
- **Metric-Driven Recommendations**: A heuristic recommender reads the *measured* metrics (noise, sharpness, exposure, contrast) and suggests the most suitable enhancement.
- **Genuine Enhancement Filters** (real convolutions / point operations, not CSS):
  - **Soft Tissue Smoothing** — separable Gaussian blur.
  - **MRI/CT Artifact Removal** — 3×3 median filter (removes salt-and-pepper noise, preserves edges).
  - **Bone Edge Enhancement** — unsharp mask (high-pass sharpening).
  - **Radiograph Inversion** — per-pixel negative.
  - **Vascular Contrast Stretch** — percentile-clipped histogram stretch.
  - Adjustable **Enhancement Intensity** (0–100%) that scales each algorithm's strength.
- **Web Worker Pipeline**: Metrics and filtering run off the main thread, with pixel buffers transferred zero-copy, so large scans don't freeze the UI.
- **Side-by-Side Comparison**: Interactive split-screen slider comparing the original and enhanced scans.
- **Export Options**: Download the processed scan as PNG or JPG, rendered from the actual processed pixels.
- **Modern UI**: Dark-themed interface with cyan/blue glassmorphism, Framer Motion animations, and responsive layout.

*Disclaimer: This tool is for demonstration and research purposes only. Not intended for direct diagnostic use without professional review.*

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Image Processing**: Custom spatial-domain algorithms over HTML5 Canvas `ImageData`, executed in a Web Worker
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **UI Components**: Shadcn UI (Radix UI primitives)
- **Routing**: Wouter

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd clinical-image-enhancer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Build for Production

```bash
npm run build
```
This generates static files in `dist/` that can be hosted on any static web host (Vercel, Netlify, GitHub Pages, etc.). The Web Worker is emitted as a separate chunk automatically. Run `npm run preview` to serve the production build locally.

## How It Works

1. **Upload**: The scan is read via the browser's `FileReader` API and decoded onto an offscreen `<canvas>`, where its raw RGBA pixels are extracted with `getImageData`.
2. **Analysis**: The pixel buffer is sent to a Web Worker, which computes the diagnostic metrics (mean/std-dev luminance, Immerkær noise estimate, Sobel edge density, HSV saturation).
3. **Recommendation**: The measured metrics feed a heuristic that selects the most appropriate enhancement (e.g. Artifact Removal for high-noise CTs, Bone Edge Enhancement for low edge definition).
4. **Processing**: The chosen filter runs in the worker as a real spatial-domain operation (separable Gaussian, median, unsharp mask, contrast stretch, or inversion) at the selected intensity, and the result is painted back to a canvas.
5. **Export**: The processed canvas is encoded to PNG or JPG and downloaded — the saved file contains the actual processed pixels.

## Project Structure

```
client/src/
  lib/
    imageProcessing.ts   # Pure, dependency-free algorithms (metrics + filters)
    imageWorker.ts       # Web Worker entry — runs imageProcessing off-thread
    imageClient.ts       # Promise-based main-thread wrapper around the worker
  pages/
    home.tsx             # UI: upload, metrics, controls, comparison, export
```

The `imageProcessing` module is intentionally pure and side-effect-free, so the algorithms can be unit-tested in isolation and reused on either the main thread or the worker.

## License

This project is licensed under the MIT License.
