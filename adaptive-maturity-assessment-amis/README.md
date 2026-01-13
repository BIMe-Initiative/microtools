# Adaptive Maturity Assessment (AMIS)

Interactive web application for measuring organizational adaptive maturity in BIM contexts, featuring a dual-axis scatter plot visualization and PDF export capabilities.

**Part of**: [BIMei Microtools Collection](../)
**Stack**: React, Vite, Recharts, reCAPTCHA
**Related**: [BIM Thinkspace Episode 28](https://BIMexcellence.org/measuring-adaptive-maturity)
**Status**: Active (v1.0)

---

## Overview

The Adaptive Maturity Assessment Microtool (AMIS) helps organizations measure and visualize their maturity across two critical dimensions:
- **Process Maturity**: How well-defined and repeatable are your processes?
- **Adaptive Capacity**: How well can you respond to change and uncertainty?

Users complete a questionnaire and receive an interactive scatter plot showing their position, along with actionable insights for improvement.

### Key Features

- **15-Question Assessment**: Balanced questions across both maturity dimensions
- **Interactive Visualization**: Real-time scatter plot showing results and comparison points
- **Quadrant Analysis**: Color-coded regions (Chaotic, Rigid, Reactive, Resilient)
- **PDF Export**: Download results with full chart visualization
- **Comparison Mode**: Compare your results against industry benchmarks
- **Email Results**: Optional email submission for follow-up (reCAPTCHA protected)
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

---

## Use Cases

1. **Organizational Self-Assessment**: Benchmark your BIM maturity
2. **Team Workshops**: Facilitate discussions about process vs. adaptability
3. **Consulting Tools**: Help clients identify improvement areas
4. **Educational Content**: Teach concepts of adaptive maturity
5. **Research**: Collect data on industry maturity trends

---

## Architecture

### Maturity Model

The assessment maps responses to a 2D space:

```
        High Adaptive Capacity
                 │
                 │ Reactive    │ Resilient
                 │             │ (Ideal)
─────────────────┼─────────────┼──────────
                 │             │
    Chaotic      │    Rigid    │
                 │             │
                 │
        Low Adaptive Capacity
```

**Quadrants**:
- **Chaotic** (Low Process, Low Adaptive): Disorganized, unpredictable
- **Rigid** (High Process, Low Adaptive): Over-structured, inflexible
- **Reactive** (Low Process, High Adaptive): Agile but inconsistent
- **Resilient** (High Process, High Adaptive): Optimal balance

---

## Files

```
adaptive-maturity-assessment-amis/
├── src/
│   ├── App.jsx               # Main application component
│   ├── main.jsx             # React entry point
│   └── assets/              # Images and assets
├── public/                  # Static assets
├── index.html               # HTML template
├── package.json             # Dependencies
├── vite.config.js          # Vite build configuration
├── eslint.config.js        # ESLint rules
└── README.md               # This file
```

---

## Quick Start

### Prerequisites

- **Node.js 20+** installed
- **npm** or **yarn** package manager

### Installation

1. **Navigate to the directory**
   ```bash
   cd adaptive-maturity-assessment-amis
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

### Preview Production Build

```bash
npm run preview
```

---

## Usage

### Assessment Flow

1. **Introduction Screen**: User sees overview and instructions
2. **Questions**: 15 questions presented one at a time
3. **Submit**: User completes assessment
4. **Results**: Interactive scatter plot with quadrant position
5. **Export**: Download PDF or compare with others

### Question Format

Each question uses a 5-point Likert scale:
- **Never** (1 point)
- **Rarely** (2 points)
- **Sometimes** (3 points)
- **Often** (4 points)
- **Always** (5 points)

### Scoring

- **Process Maturity**: Average of process-related questions
- **Adaptive Capacity**: Average of adaptability-related questions
- **Result**: Plotted on 1-5 scale for both axes

---

## Configuration

### Brand Customization

Edit constants in `App.jsx`:

```javascript
const BRAND_COLOR = "#f37f73";  // BIMei coral
const EPISODE_TITLE_PREFIX = "BIM THINKSPACE EPISODE 28:";
const POST_URL = "https://BIMexcellence.org/measuring-adaptive-maturity";
```

### reCAPTCHA

Update the site key in `App.jsx`:

```javascript
const RECAPTCHA_SITE_KEY = "6LeAJR0sAAAAAG2bBy6MqmJbzmpa6_KjplWXrfXz";
```

Get your key from: [Google reCAPTCHA](https://www.google.com/recaptcha/admin)

### Questions

Edit the `questions` array in `App.jsx` to customize assessment content:

```javascript
{
  text: "Your question text",
  category: "process",  // or "adaptive"
  weight: 1.0  // optional weighting
}
```

---

## Deployment

### Static Hosting (Netlify, Vercel)

1. **Build the app**
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` folder**
   - Netlify: Drag and drop or connect to GitHub
   - Vercel: `vercel --prod`
   - GitHub Pages: Copy `dist/` contents to `gh-pages` branch

### Apache/Nginx

After building, copy `dist/` contents to web server:

```bash
npm run build
cp -r dist/* /var/www/html/amis/
```

### Google Cloud Storage

```bash
npm run build
gsutil -m cp -r dist/* gs://your-bucket/amis/
gsutil setmeta -h "Cache-Control:public, max-age=3600" gs://your-bucket/amis/*
```

---

## Features Deep Dive

### PDF Export

Uses **html2canvas** and **jsPDF** to generate downloadable PDFs:

```javascript
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Captures the results visualization and exports as PDF
const handlePDFExport = async () => {
  const canvas = await html2canvas(resultsRef.current);
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF();
  pdf.addImage(imgData, 'PNG', 10, 10);
  pdf.save('adaptive-maturity-results.pdf');
};
```

### Scatter Plot Visualization

Built with **Recharts**:

```jsx
<ScatterChart width={600} height={400}>
  <XAxis dataKey="process" domain={[1, 5]} label="Process Maturity" />
  <YAxis dataKey="adaptive" domain={[1, 5]} label="Adaptive Capacity" />
  <Scatter data={[userResult]} fill="#f37f73" />
  <ReferenceArea /* Quadrants */ />
</ScatterChart>
```

### Email Submission

Protected with reCAPTCHA v2:

```jsx
<ReCAPTCHA
  sitekey={RECAPTCHA_SITE_KEY}
  onChange={handleRecaptcha}
/>
```

---

## Customization

### Adding New Questions

1. Open `src/App.jsx`
2. Add to the `questions` array:

```javascript
{
  text: "Our team adapts quickly to new BIM software",
  category: "adaptive"
}
```

3. Questions are automatically scored and categorized

### Changing Quadrant Colors

Edit the `ReferenceArea` components in the scatter chart:

```jsx
<ReferenceArea
  x1={1} x2={3}
  y1={3} y2={5}
  fill="#10b981"  // Change this color
  fillOpacity={0.1}
/>
```

### Modifying Score Calculation

Edit the `calculateScore()` function in `App.jsx`:

```javascript
const calculateScore = () => {
  const processQuestions = questions.filter(q => q.category === 'process');
  const adaptiveQuestions = questions.filter(q => q.category === 'adaptive');

  const processScore = average(processQuestions.map(q => responses[q.id]));
  const adaptiveScore = average(adaptiveQuestions.map(q => responses[q.id]));

  return { process: processScore, adaptive: adaptiveScore };
};
```

---

## Development

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

### Code Structure

```
src/
├── App.jsx           # Main component with all logic
│   ├── State management (useState)
│   ├── Question rendering
│   ├── Score calculation
│   ├── Chart visualization
│   └── PDF export
├── main.jsx          # React rendering
└── assets/           # Static files
```

### Key Dependencies

```json
{
  "react": "^18.3.1",
  "recharts": "^2.15.0",
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.2",
  "react-google-recaptcha": "^3.1.0",
  "lucide-react": "^0.468.0"
}
```

---

## Accessibility

- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Space)
- **Screen Readers**: Semantic HTML with proper headings
- **Color Contrast**: WCAG AA compliant
- **Focus Indicators**: Visible focus states for navigation

---

## Performance

- **Bundle Size**: ~150KB gzipped (with all dependencies)
- **Load Time**: < 1 second on modern connections
- **Rendering**: Optimized with React hooks and memoization
- **PDF Generation**: ~2-3 seconds for typical results

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

---

## Troubleshooting

### Issue: Chart not rendering
**Solution**:
- Ensure all questions are answered
- Check browser console for errors
- Verify Recharts is installed: `npm install recharts`

### Issue: PDF export fails
**Solution**:
- Allow pop-ups in browser
- Check html2canvas compatibility
- Ensure results section has rendered

### Issue: reCAPTCHA not showing
**Solution**:
- Verify `RECAPTCHA_SITE_KEY` is correct
- Check domain is registered in reCAPTCHA admin
- Ensure internet connection (reCAPTCHA loads from Google)

---

## Related Resources

### BIM Thinkspace
- **Episode 28**: [Measuring and Improving Adaptive Maturity](https://BIMexcellence.org/measuring-adaptive-maturity)
- **Podcast**: Detailed discussion of the maturity model

### Related Tools
- [adaptive-maturity-map](../adaptive-maturity-map/) - Companion visualization tool
- [amx](../amx/) - AMX widget embedding utilities

---

## Credits

**Version**: v1.0 (1 Dec 2025)
**Created by**: BIM Excellence Initiative
**Related Content**: BIM Thinkspace Episode 28

Built with:
- React + Vite
- Recharts for visualizations
- html2canvas + jsPDF for export
- Google reCAPTCHA for security
- Lucide React for icons

---

## License

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Part of the BIMei Microtools Collection. Licensed under CC BY-NC-SA 4.0.

---

## Support

**Issues**: Create an issue in the GitHub repository
**Documentation**: This README
**Related Content**: [BIMexcellence.org](https://BIMexcellence.org)
