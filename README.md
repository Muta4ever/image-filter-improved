# Medical Image Enhancement Application

A React-based web application that analyzes clinical images and provides AI-powered filter recommendations to enhance diagnostic clarity. The application extracts EXIF metadata and image properties, then uses OpenAI's API to generate personalized enhancement suggestions tailored to specific medical imaging needs.

## Features

- **Image Upload & Analysis**: Upload clinical images with automatic EXIF data extraction
- **AI-Powered Recommendations**: Leverages OpenAI API to analyze image characteristics and suggest optimal filters
- **Real-time Enhancement Preview**: Apply recommended filters and compare before/after views
- **Diagnostic Clarity Focus**: Filters specifically designed to improve visibility of clinical features
- **Responsive Design**: Modern UI with dark mode support and glass-morphism effects

## Tech Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Vite** - Build tool and dev server

### Backend
- **Express.js** - Server framework
- **OpenAI API** - AI-powered image analysis
- **Multer** - File upload handling
- **PostgreSQL** - Database (with Drizzle ORM)
- **Passport.js** - Authentication

### Additional Tools
- **ExifReader** - EXIF metadata extraction
- **Canvas API** - Image manipulation
- **ESBuild** - Server bundling for optimized deployment

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd medical-image-enhancement
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/medical_images
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_session_secret
NODE_ENV=development
```

4. Run database migrations:
```bash
npm run db:push
```

## Usage

### Development
```bash
npm run dev
```
This starts both the Vite dev server (frontend) and Express server (backend).

### Production Build
```bash
npm run build
npm start
```

### Build Process
The application uses a custom build script that:
- Bundles the client with Vite
- Bundles the server with ESBuild (bundling key dependencies to reduce cold start times)
- Minifies all code for production deployment

## How It Works

1. **Image Upload**: Users upload clinical images through the web interface
2. **Metadata Extraction**: The application extracts EXIF data (camera settings, resolution, color space, etc.)
3. **Image Analysis**: Image properties (dimensions, color distribution, contrast levels) are computed
4. **AI Processing**: OpenAI API analyzes the image characteristics and generates filter recommendations
5. **Enhancement**: Users can apply suggested filters and download enhanced images

## Filter Types

The application supports various enhancement filters:
- **Contrast Enhancement** - Improves visibility of subtle features
- **Sharpening** - Enhances edge definition
- **High-pass Filtering** - Emphasizes fine details
- **Color Balance** - Corrects color casts for accurate representation
- **Noise Reduction** - Reduces grain while preserving detail

## API Endpoints

- `POST /api/upload` - Upload and analyze medical image
- `POST /api/analyze` - Get AI-powered filter recommendations
- `GET /api/images/:id` - Retrieve processed image
- `POST /api/apply-filter` - Apply selected filter to image

## Security Considerations

- Input validation with Zod schemas
- Rate limiting on API endpoints
- Secure session management
- File upload size restrictions
- EXIF data sanitization

## Performance Optimizations

- Server dependency bundling reduces cold start time by minimizing file I/O operations
- Image processing handled asynchronously
- Optimized bundle sizes with tree-shaking
- Lazy loading for non-critical components

## Future Enhancements

- [ ] DICOM format support
- [ ] Batch image processing
- [ ] Custom filter creation interface
- [ ] Image comparison tools (side-by-side, overlay)
- [ ] Export to medical reporting formats
- [ ] Integration with PACS systems

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the API that powers intelligent filter recommendations
- The medical imaging community for inspiration and use case guidance

## Contact

For questions or support, please open an issue on GitHub.
