# AI Image Filter App

A React-based web application that analyzes images and provides intelligent filter recommendations. This frontend-only application allows users to upload images, view detailed image metrics, and apply professional-grade filters with precision control.

## Features

- **Image Upload**: Drag-and-drop interface for uploading JPG and PNG images.
- **Image Metrics Analysis**: Calculates simulated metrics for blur, brightness, contrast, noise level, sharpness, and saturation.
- **AI-Powered Recommendations**: Analyzes image characteristics to suggest the optimal filter for enhancing the image.
- **Advanced Filter Controls**: 
  - Apply Gaussian Blur, Median Blur, Low Pass, and High Pass filters.
  - Adjust Kernel Size (1-31).
  - Adjust Filter Intensity (0-100%).
- **Side-by-Side Comparison**: Interactive split-screen slider to compare the original and filtered images in real-time.
- **Export Options**: Download your processed image as a high-quality PNG or JPG file.
- **Modern UI**: Polished dark-themed interface with glassmorphism effects, smooth animations (Framer Motion), and responsive design.

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
cd ai-image-filter
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

1. **Upload**: Users upload an image which is loaded via the browser's `FileReader` API.
2. **Analysis**: The app generates metrics representing the image's characteristics.
3. **Recommendation**: Based on the metrics, the app's logic determines the most suitable filter (e.g., Median blur for noisy images, High Pass for blurry images).
4. **Processing**: Filters are applied dynamically using CSS `filter` properties for the preview.
5. **Export**: When saving, the app uses an offscreen HTML5 `<canvas>` to accurately render the original image with the exact filter and intensity settings before triggering a download.

## License

This project is licensed under the MIT License.
