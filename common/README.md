# Common Resources

Shared resources, brand assets, and configuration files used across multiple BIMei microtools.

**Part of**: [BIMei Microtools Collection](../)
**Purpose**: Shared resources and utilities
**Status**: Active

---

## Overview

This directory contains common files referenced by multiple tools in the microtools collection, including:

- **Brand assets**: CSS, logos, color schemes
- **Configuration files**: Shared settings and templates
- **Documentation**: BIM ontology and weights
- **Utilities**: Reusable JavaScript/CSS components

---

## Files

```
common/
├── brand.css                              # BIMei brand styling
├── embed.js                               # Embedding utilities
├── BIMei Ontology 251226.docx            # BIM ontology document
├── BIMei_Ontology_Weights_v1_Backup_260103.json  # Graph weights
├── UI_Sample.html                        # UI component samples
└── README.md                             # This file
```

---

## Brand Assets

### brand.css

Standard BIMei brand colors and typography:

```css
/* Primary brand color */
--bimei-coral: #f37f73;

/* Typography */
font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
```

**Usage**:
```html
<link rel="stylesheet" href="../common/brand.css" />
```

---

## Ontology Resources

### BIMei Ontology Document

Comprehensive documentation of the BIM knowledge ontology including:
- Concept definitions
- Relationship types
- Taxonomy structure
- Domain modeling

### Ontology Weights JSON

Graph weights for Semantic Evidence Weight (SEW) calculations:

```json
{
  "nodes": {
    "DictionaryItem": 1.0,
    "Construct": 0.9,
    "ActionStatement": 0.8
  },
  "relationships": {
    "RELATES_TO": 1.0,
    "PART_OF": 0.9,
    "ENABLES": 0.8
  }
}
```

**Used by**:
- [bimei-kb-dashboard](../bimei-kb-dashboard/)
- [vertex_cx_chatbot](../vertex_cx_chatbot/)

---

## Embedding Utilities

### embed.js

Reusable JavaScript utilities for embedding widgets and components.

**Features**:
- Widget injection
- Iframe management
- Cross-origin messaging
- Responsive sizing

---

## UI Samples

### UI_Sample.html

Reference implementation of common UI patterns:
- Card layouts
- Form controls
- Navigation patterns
- Responsive grids

**Purpose**: Design reference for new tools

---

## Usage in Other Tools

### Importing Brand Styles

```html
<!-- In your HTML file -->
<link rel="stylesheet" href="../common/brand.css" />
```

### Importing Weights

```javascript
// In Node.js
import weights from '../common/BIMei_Ontology_Weights_v1_Backup_260103.json';

// Calculate SEW
const sew = calculateSEW(path, weights);
```

### Using Embed Utilities

```html
<script src="../common/embed.js"></script>
<script>
  embedWidget('my-container', 'widget-url');
</script>
```

---

## Adding New Common Resources

When adding new shared resources:

1. **Place in common/**
2. **Document in this README**
3. **Update references** in tools that use them
4. **Test across tools** to ensure compatibility

---

## Related Tools

All tools in the microtools collection may reference resources from this directory:

- [adaptive-maturity-assessment-amis](../adaptive-maturity-assessment-amis/)
- [bimei-kb-dashboard](../bimei-kb-dashboard/)
- [vertex_cx_chatbot](../vertex_cx_chatbot/)
- [amx](../amx/)

---

## License

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Part of the BIMei Microtools Collection. Licensed under CC BY-NC-SA 4.0.
