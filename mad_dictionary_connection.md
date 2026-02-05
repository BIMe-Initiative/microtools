# Macro Adoption Dashboard (MAD) — BIM Dictionary Modal Plan

> **Note:** The MAD repository path you provided (`/Users/bilalsuccar/Documents/microtools/macro-adoption-dashboard`) is not accessible from this environment. I attempted to list it and received a "No such file or directory" error. As a result, the stack-specific adjustments below are provisional. Once the MAD repo is available in this environment, I will update this plan with concrete file paths, framework hooks, and state management integration.

## Current understanding (based on assessor.io implementation)
The assessor.io app implements a BIM Dictionary modal that:
- Opens from a global handler (`window.openTermModal`).
- Fetches term definitions from:
  - `https://bimdictionary.com/api/v1/terms/by_title?title=<term>&lang=<locale>`
- Renders the term title and description and performs `[[term]]` markup replacement for nested terms.

## Execution plan (to be updated after MAD repo inspection)

### 1) Confirm MAD stack + entry point
- Identify the top-level application shell (e.g., `App.tsx`, `App.jsx`, or layout root).
- Confirm the framework (React, Vue, Svelte, etc.), routing solution, and state management (Redux/Zustand/Context/MobX).

**Deliverable:** A modal that can be rendered at the root level so it is available across the app.

---

### 2) Implement BIM Dictionary modal component
- Create a `BimDictTermModal` component that:
  - Accepts `open`, `term`, and `onClose` props.
  - Fetches term definitions from the BIM Dictionary API on open.
  - Renders title + description with loading/error handling.
  - Uses the app’s current locale to set the `lang` query param.

**Endpoint:**
```
GET https://bimdictionary.com/api/v1/terms/by_title?title=<term>&lang=<locale>
```

---

### 3) Add global term-modal trigger
- Add a global handler to open the modal (choose based on MAD stack):
  - **React + Context:** create a `TermModalProvider` with `openTermModal(term)`.
  - **Redux:** dispatch an `openTermModal(term)` action.
  - **Zustand/other store:** expose a store setter.

**Goal:** any UI layer can open the modal without prop drilling.

---

### 4) Convert all `[[term]]` into hover + click affordances
- Build a `TermText` component (or markdown renderer extension) that:
  - Parses the input text and replaces `[[term]]` patterns with interactive elements.
  - Applies consistent hover styling (underline, cursor, color).
  - Calls `openTermModal(term)` on click.

**Regex:**
```
/\[\[(.*?)\]\]/g
```

---

### 5) Hover UI + accessibility
- Add CSS for hover, focus, and keyboard interaction.
- Ensure screen-reader friendly labels.

---

### 6) Localization support
- Use MAD’s locale system for `lang` query param.
- Fallback to `en` if no locale is set.

---

### 7) Rollout strategy
- Identify all text-rendering surfaces that include BIM terminology.
- Replace their renderers with `TermText` or the markdown extension.

---

### 8) Testing + QA checklist
- Confirm any `[[term]]` shows hover effect.
- Click opens modal and fetches definition.
- Missing term and API error states are clean.
- Locale affects `lang` parameter.

---

## Next action needed
Once the MAD repo is accessible locally here, I will:
1. Inspect the stack and routing/state architecture.
2. Replace the placeholders above with exact file paths + implementation details.
3. Provide a concrete integration patch aligned with MAD conventions.
