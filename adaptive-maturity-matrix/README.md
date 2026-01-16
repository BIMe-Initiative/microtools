# AMX (Adaptive Maturity eXplorer)

Embeddable Adaptive Maturity Matrix widget with an Investigate view and a guided Plan workflow for current-to-target transitions.

**Part of**: [BIMei Microtools Collection](../)
**Stack**: HTML, JavaScript, CSS
**Related**: [Adaptive Maturity Assessment](../adaptive-maturity-assessment-amis/)
**Status**: Utility

---

## Overview

AMX provides an embeddable widget for exploring adaptive maturity microstates and creating a simple improvement plan based on a selected current and target state. Content is sourced from shared JSON files so the widget and WordPress can stay in sync.

### Key Features

- **Investigate Mode**: Explore microstates and key characteristics
- **Plan Mode**: Select current and target microstates and generate recommendations
- **Search Functionality**: Full-text search across microstate content
- **JSON-Driven Content**: Matrix data and action statements live in versioned JSON files
- **Responsive Design**: Works on desktop and mobile
- **WordPress Ready**: Includes a shortcode snippet to render the matrix natively

---

## Files

```
adaptive-maturity-matrix/
├── index.html              # Main AMX widget with all functionality
├── data/
│   ├── amx-content.json    # Matrix content
│   └── amx-actions.json    # Action statements (Episode 28)
├── assets/
│   ├── BIMei-Logo-Long.svg
│   ├── BIMei-Symbol-Circle.svg
│   └── fonts/              # Local Raleway fonts
├── deployment.md           # WordPress + data deployment notes
└── README.md               # This file
```

---

## Quick Start

### Embedding in a Website

1. **Copy the widget code**
   ```html
   <div id="amx-widget" lang="en" role="region" aria-label="Adaptive Maturity Matrix">
     <!-- Widget content from index.html -->
   </div>
   ```

2. **Include in your HTML**
   - For WordPress: Add to a Custom HTML block
   - For Typepad: Add to a post or page
   - For custom sites: Insert directly into HTML

---

## Widget Structure

### Investigate
```
┌─────────────────────────────────────┐
│ Header + Search + Mode Tabs         │
├─────────────────────────────────────┤
│ Matrix Grid + Summary               │
├─────────────────────────────────────┤
│ Detail Panel                        │
└─────────────────────────────────────┘
```

### Plan
```
┌─────────────────────────────────────┐
│ Step Prompt                         │
├─────────────────────────────────────┤
│ Matrix Grid + Current/Target        │
├─────────────────────────────────────┤
│ Recommendations Panel               │
└─────────────────────────────────────┘
```

---

## Data Sources

- Matrix content: `data/amx-content.json`
- Action statements: `data/amx-actions.json`

To override the default data sources:

```
index.html?data=<content_url>&actions=<actions_url>
```

---

## WordPress Integration

See `deployment.md` for the shortcode and caching details to render the matrix natively in WordPress.
