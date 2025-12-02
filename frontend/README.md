# Project Generator - Frontend

React + TypeScript + Vite frontend with Tailwind CSS and shadcn/ui components.

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Features

- **Project Configuration**: Upload BRD files, configure generation options
- **Real-time Progress**: Poll-based progress tracking with step-by-step status
- **Results Viewer**: Browse generated EPICs, User Stories, Tests, and Data Models
- **Code Skeleton**: Tree view of generated ASP.NET code with file preview
- **Download**: ZIP download of all generated artifacts

## Pages

1. `/` - Configuration page (file upload + settings)
2. `/progress/:jobId` - Generation progress with polling
3. `/results/:jobId` - Project specifications viewer
4. `/code/:jobId` - Code skeleton browser

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.
