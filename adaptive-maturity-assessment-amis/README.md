# Adaptive Maturity Assessment (AMIS)

Interactive web application for measuring organizational adaptive maturity in BIM contexts, featuring a dual-axis scatter plot visualization and PDF export capabilities.

**Part of**: [BIMei Microtools Collection](../)
**Stack**: React, Vite, Recharts, reCAPTCHA
**Related**: [BIM Thinkspace Episode 28](https://bimexcellence.org/thinkspace/episode-28-measuring-adaptive-maturity/)
**Status**: Active (v1.1)

---

## Overview

The Adaptive Maturity Assessment Microtool (AMIS) helps organizations measure and visualize their maturity across two critical dimensions:
- **Process Maturity**: How well-defined and repeatable are your processes?
- **Adaptive Capacity**: How well can you respond to change and uncertainty?

Users rate Episode 28's 13 Adaptive Maturity Indicators (AMIs) and see their microstate, State, axis scores and composite score on the Adaptive Maturity map. It is a taster for Assessor.io's full Adaptive Maturity Specialised Set (SS-ADM), which it links to.

### Key Features

- **13 indicators**: each rated 1 to 5 against its five-level ladder (the corrected, gap-free ladders)
- **Interactive Visualization**: Real-time chart with Episode 27's four overlapping State clusters
- **Microstate and State**: the cell (a1 to e5) and its State or overlap, from Episode 28 Table 2 as corrected
- **Composite score**: 4 x row x column (4 to 100) and its band
- **PDF Export**: Download results with full chart visualization (reCAPTCHA protected)
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

The assessment places an organisation on the 5 x 5 Adaptive Maturity matrix (BIM ThinkSpace Episodes 27 and 28): process maturity (PMI) as columns a to e, adaptive capacity (ACI) as rows 1 to 5. Episode 27's four States are overlapping clusters of three columns by three rows:

- **Stagnant**: a1 to c3
- **Chaotic**: a3 to c5
- **Dynamic**: c3 to e5
- **Rigid**: c1 to e3

Every cell in column c or row 3 belongs to two States, and c3 belongs to all four.

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

### Scoring

Corrected on 31 Oct 2026 to match the corrected Episode 28 and Assessor.io's SS-ADM:

- **Axes**: PMI is the average of AMI-1 and AMI-11; ACI is the average of the other nine indicators. AMI-6 and AMI-10 count half on each axis, in the sum and in the count, so PMI divides by 3 and ACI by 10.
- **Placement**: each average is rounded once, to the nearest level, and a half rounds up (3.45 is level 3, 3.5 is level 4). Scores are shown to one decimal, or two where one decimal would show a half the score has not reached.
- **Composite**: the cell's value, 4 x row x column with column a counted as 1, from 4 (a1) to 100 (e5).
- **Bands**: Low 10 or less, Medium-Low 11 to 20, Medium 21 to 45, Medium-High 46 to 75, High 76 and above.

---

## Configuration

### Brand Customization

Edit constants in `App.jsx`:

```javascript
const BRAND_COLOR = "#f37f73";  // BIMei coral
const EPISODE_TITLE_PREFIX = "BIM THINKSPACE EPISODE 28:";
const POST_URL = "https://bimexcellence.org/thinkspace/episode-28-measuring-adaptive-maturity/";
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
- **Episode 28**: [Measuring and Improving Adaptive Maturity](https://bimexcellence.org/thinkspace/episode-28-measuring-adaptive-maturity/)
- **Podcast**: Detailed discussion of the maturity model

### Related Tools
- [adaptive-maturity-map](../adaptive-maturity-map/) - Companion visualization tool
- [adaptive-maturity-matrix](../adaptive-maturity-matrix/) - Embeddable widget

---

## Credits

**Version**: v1.1 (31 Oct 2026): scoring, Table 2 labels and ladders corrected; link to the full SS-ADM. v1.0 (1 Dec 2025).
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
