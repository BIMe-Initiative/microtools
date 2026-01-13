# Adaptive Maturity Map

Companion visualization tool for the Adaptive Maturity Assessment, providing an alternative mapping interface for maturity assessment results.

**Part of**: [BIMei Microtools Collection](../)
**Stack**: React, Vite
**Related**: [Adaptive Maturity Assessment (AMIS)](../adaptive-maturity-assessment-amis/)
**Status**: Active

---

## Overview

This tool complements the main Adaptive Maturity Assessment by providing additional visualization and mapping capabilities for maturity data. It uses the same React + Vite technology stack for consistency with the AMIS tool.

### Key Features

- **React-based Visualization**: Fast, interactive mapping interface
- **Vite Build System**: Modern, optimized development and build process
- **Companion Tool**: Works alongside the main AMIS assessment
- **Responsive Design**: Works across devices

---

## Quick Start

### Prerequisites

- **Node.js 20+** installed
- **npm** or **yarn** package manager

### Installation

1. **Navigate to the directory**
   ```bash
   cd adaptive-maturity-map
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

---

## Development

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

---

## Deployment

Same deployment options as the main AMIS tool:

- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **Cloud Storage**: Google Cloud Storage, AWS S3
- **Traditional Hosting**: Apache, Nginx

See [Adaptive Maturity Assessment README](../adaptive-maturity-assessment-amis/README.md) for detailed deployment instructions.

---

## Related Tools

- [adaptive-maturity-assessment-amis](../adaptive-maturity-assessment-amis/) - Main assessment tool
- [amx](../amx/) - AMX widget embedding utilities
- [BIM Thinkspace Episode 28](https://BIMexcellence.org/measuring-adaptive-maturity) - Background on adaptive maturity

---

## License

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Part of the BIMei Microtools Collection. Licensed under CC BY-NC-SA 4.0.
