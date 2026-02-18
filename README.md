# DocMerge

A fast, secure, and privacy-focused PDF and image merger that runs entirely in your browser.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **PDF & Image Merging** - Combine PDFs and images (PNG, JPEG) into a single document
- **Client-Side Processing** - All files are processed locally in your browser; nothing is uploaded to any server
- **Password-Protected PDFs** - Unlock and merge password-protected PDF files
- **Drag & Drop Reordering** - Easily reorder files before merging
- **Compression Options** - Choose from High, Balanced, or Small quality presets
- **Custom Page Settings** - Support for A4, Letter, Legal, and custom page sizes
- **Offline Support** - Works offline as a Progressive Web App (PWA)
- **Responsive Design** - Works on desktop, tablet, and mobile devices

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript 5.7
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI primitives
- **PDF Processing:** pdf-lib, pdfjs-dist
- **State Management:** Zustand
- **Testing:** Vitest, Playwright, Testing Library
- **PWA:** @ducanh2912/next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/DeepLajpal/DocMerge.git
cd DocMerge

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
pnpm build
pnpm start
```

## Scripts

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `pnpm dev`           | Start development server          |
| `pnpm build`         | Build for production              |
| `pnpm start`         | Start production server           |
| `pnpm lint`          | Run ESLint                        |
| `pnpm lint:fix`      | Fix ESLint errors                 |
| `pnpm type-check`    | Run TypeScript type checking      |
| `pnpm test`          | Run unit tests (Vitest)           |
| `pnpm test:run`      | Run tests once                    |
| `pnpm test:coverage` | Run tests with coverage           |
| `pnpm test:e2e`      | Run end-to-end tests (Playwright) |

## File Limits

| Limit          | Value    |
| -------------- | -------- |
| Max file size  | 100 MB   |
| Max total size | 500 MB   |
| Max file count | 50 files |

## Compression Levels

| Level    | Image Quality  | Typical Reduction |
| -------- | -------------- | ----------------- |
| High     | 100% (PNG)     | 5-10%             |
| Balanced | 75% (JPEG 85%) | 40-60%            |
| Small    | 50% (JPEG 75%) | 60-80%            |

## Security

- **Magic bytes validation** - Verifies actual file content matches claimed type
- **Security headers** - CSP, HSTS, X-Frame-Options, and more
- **No server uploads** - Complete client-side processing
- **Error boundaries** - Graceful error handling throughout the app

## Project Structure

```
├── app/                  # Next.js App Router pages
├── components/           # React components
│   ├── doc-merge/        # Main app components
│   └── ui/               # Reusable UI components
├── lib/                  # Utilities and business logic
│   ├── file-utils.ts     # File validation
│   ├── pdf-utils.ts      # PDF processing
│   ├── store.ts          # Zustand state management
│   └── types.ts          # TypeScript types
├── public/               # Static assets
├── __tests__/            # Unit tests
└── e2e/                  # End-to-end tests
```

## License

MIT

## Author

Deep Lajpal - [@DeepLajpal](https://github.com/DeepLajpal)
