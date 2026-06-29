# Clinical AI Image Enhancer

A React-based web application tailored for medical imaging professionals. It analyzes clinical images like X-Rays, MRIs, and CT scans to provide intelligent, diagnostic-focused filter recommendations. This frontend-only application allows users to upload clinical scans, view simulated clinical metrics, and apply professional-grade filters with precision control to clarify anatomical structures.

## Features

- **Clinical Image Upload**: Drag-and-drop interface for uploading JPG and PNG medical scans.
- **Diagnostic Metrics Analysis**: Calculates simulated metrics tailored to medical imaging: Softness, Exposure, Contrast, Artifact Level, Edge Definition, and Tissue Saturation.
- **AI-Powered Recommendations**: Analyzes scan characteristics to suggest the optimal clinical filter for highlighting fractures, soft tissue, or blood vessels.
- **Clinical Enhancement Controls**: 
  - Apply Soft Tissue Smoothing, MRI/CT Artifact Removal, Bone Edge Enhancement, Radiograph Inversion (Negative), and Vascular Contrast Stretch.
  - Adjust Enhancement Intensity (0-100%) dynamically.
- **Side-by-Side Comparison**: Interactive split-screen slider to compare the original and enhanced scans in real-time.
- **Export Options**: Download your enhanced diagnostic scan as a high-quality PNG or JPG file.
- **Modern UI**: Polished dark-themed interface with clinical cyan/blue glassmorphism effects, smooth animations (Framer Motion), and responsive design.

*Disclaimer: This tool is for demonstration and research purposes only. Not intended for direct diagnostic use without professional review.*

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
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

To create a production-ready build:
```bash
npm run build
```
This will generate static files in the `dist` (or `dist/public`) directory that can be hosted on any static web hosting service (Vercel, Netlify, GitHub Pages, etc.).

## How It Works

1. **Upload**: Users upload a medical scan which is loaded via the browser's `FileReader` API.
2. **Analysis**: The app generates clinical metrics representing the scan's diagnostic characteristics.
3. **Recommendation**: Based on the metrics, the AI logic determines the most suitable enhancement (e.g., Artifact Removal for noisy CTs, Bone Edge Enhancement for blurry skeletal X-rays).
4. **Processing**: Filters are applied dynamically using CSS `filter` and `invert` properties for the live preview.
5. **Export**: When saving, the app uses an offscreen HTML5 `<canvas>` to accurately render the original scan with the exact filter and intensity settings before triggering a download.

## License

This project is licensed under the MIT License.
