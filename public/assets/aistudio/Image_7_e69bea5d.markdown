---
name: Evaluation Workspace
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#414752'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#717783'
  outline-variant: '#c1c6d4'
  surface-tint: '#005faf'
  primary: '#005dac'
  on-primary: '#ffffff'
  primary-container: '#1976d2'
  on-primary-container: '#fffdff'
  inverse-primary: '#a5c8ff'
  secondary: '#875200'
  on-secondary: '#ffffff'
  secondary-container: '#f89c00'
  on-secondary-container: '#623a00'
  tertiary: '#196b22'
  on-tertiary: '#ffffff'
  tertiary-container: '#368539'
  on-tertiary-container: '#fcfff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a5c8ff'
  on-primary-fixed: '#001c3a'
  on-primary-fixed-variant: '#004786'
  secondary-fixed: '#ffddba'
  secondary-fixed-dim: '#ffb865'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#663d00'
  tertiary-fixed: '#a3f69c'
  tertiary-fixed-dim: '#88d982'
  on-tertiary-fixed: '#002204'
  on-tertiary-fixed-variant: '#005312'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  h4:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '600'
    lineHeight: 42px
    letterSpacing: -0.015em
  h4-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  h5:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0em
  h6:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0.0075em
  subtitle1:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0.009em
  subtitle2:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.007em
  body1:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0.01em
  body2:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.015em
  button:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.025em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.033em
  overline:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an enterprise-grade, high-density digital workspace tailored for AI-assisted academic and professional evaluation. The aesthetic aligns with the refined utility of Material Design (MUI v5), optimized specifically for high-throughput operational efficiency, data integrity, and prolonged focus.

The interface addresses academic evaluators, institutional auditors, and examination administrators who need to review high-stakes grading workflows quickly and accurately. The visual tone is disciplined, objective, and institutional. It balances administrative rigor with responsive visual cues that indicate machine confidence, anomaly detection, and score aggregations.

The design movement is **Corporate / Modern High-Density Utility**. It avoids decorative trends in favor of structural clarity, precise typography, structured data boundaries, and crisp hierarchical surfaces that support intensive multi-pane grading screens.

## Colors

The palette is rooted in MUI standard chromatic roles, tuned for dense information architectures and high contrast.

- **Primary (`#1976D2`)**: Drives the visual anchor points, active states, key interactive controls, selected navigation items, and positive progression. Supported by Primary Dark (`#115293`) for hover states/headers and Primary Light (`#4791db`) for subtle active highlights.
- **Secondary (`#FFA000`)**: Amber acts as a targeted accent for human-in-the-loop interventions, flagging AI ambiguities, confidence scores requiring manual review, and operational alerts.
- **Functional Semantics**:
  - Success (`#2E7D32`): High AI-confidence markers, verified marks, successfully synchronized records.
  - Warning (`#ED6C02`): Score discrepancies, borderline evaluations, OCR discrepancies.
  - Error (`#D32F2F`): Unmatched candidate identities, malformed answer sheets, hard validation rejections.
- **Neutrals & Surfaces**:
  - Background (`#F4F6F8`): Cool tinted slate gray that diminishes eye fatigue across long grading sessions.
  - Surface (`#FFFFFF`): Crisp card and canvas containers for scanned scripts and data grids.
  - Text Primary (`#1E293B`): Deep slate for maximum legibility of scores and annotation text.
  - Text Secondary (`#64748B`): Controlled mid-tone for system metadata, table headers, and timestamps.
  - Border (`#E2E8F0`): Explicit structure separation between dense visual panels.

## Typography

The type scale utilizes **Inter** for all text roles to provide uniform character rendering, precise tabular numerals, and high optical legibility within high-density data tables and small-scale score badges.

- **Headlines (h4-h6)**: Form structural breaks in the assessment workflow, cohort views, and batch-processing screens. Reduced slightly from classic display sizes to support dense enterprise displays.
- **Subtitles & Overlines**: Reserved for metadata classification, student candidate anonymized identifiers, question numbers, and assessment rubric keys. Overlines are consistently uppercase with expanded letter-spacing.
- **Body & Data (body1, body2)**: `body1` provides standard reading cadence for assessment guides and rubric descriptions. `body2` serves as the primary evaluation density scale for itemized question sheets, system comments, and OCR-extracted responses.
- **Captions & Numerical Badges**: `caption` anchors input helpers, validation thresholds, and confidence level labels. Tabular alignment is enforced for all numerical point allocations.

## Layout & Spacing

The layout philosophy follows a high-density, multi-pane fixed-workspace model designed for complex evaluation screens.

### Grid Architecture & Spacing Rhythm
- **Global Rhythm**: Built on a compact 4px/8px sub-grid module. Default component padding uses `space-sm` (8px) and `space-md` (12px) to allow simultaneous side-by-side presentation of document scans and grading rubrics.
- **Main Workspace Panes**:
  - **Left Rail**: 240px fixed permanent drawer for batch navigation, candidate indices, and system metrics. Collapsible to 64px icon-only state for lower resolution viewports.
  - **Primary Stage (Dual-Pane Split)**: 60% viewport width allocated to high-resolution answer script inspection; 40% allocated to AI scoring panels, rubric criteria checklists, and manual override fields.
  - **Top App Bar**: 48px dense application bar containing assessment stage breadcrumbs, real-time sync indicators, and action triggers.

### Responsive Reflow Rules
- **Desktop (≥ 1280px)**: Permanent side drawer, dual synchronized viewing panes, fixed sticky action footers.
- **Tablet Landscape (960px - 1279px)**: Drawer toggles to temporary overlay; split workspace stacks on a segmented tab toggle (Canvas vs. Evaluation Panel).
- **Mobile / Compact (< 960px)**: Evaluator workspace locks into review-only modal workflows with single-column linear layout, full-width `margin-mobile`, and bottom navigation sheets.

## Elevation & Depth

Elevation is structured around standard MUI material physics with tight, cool-tinted shadow distributions to maintain separation without visual clutter.

- **Level 0 (Flat / Canvas)**: Applied to background workspaces (`#F4F6F8`) and inset text inputs. Separations are achieved via hairline `#E2E8F0` borders rather than shadows.
- **Level 1 (Paper Cards / DataGrid Containers)**: `box-shadow: 0px 1px 3px 0px rgba(30, 41, 59, 0.08), 0px 1px 1px 0px rgba(30, 41, 59, 0.04)`. Encloses individual student answer cards, evaluation question units, and metadata cards.
- **Level 2 (Hover States / Active Toolbar)**: `box-shadow: 0px 3px 6px -1px rgba(30, 41, 59, 0.12), 0px 2px 4px -1px rgba(30, 41, 59, 0.06)`. Used for hovered interactive table rows, focused scoring widgets, and sticky toolbars.
- **Level 3 (Floating Controls & Navigation Rails)**: `box-shadow: 0px 10px 15px -3px rgba(30, 41, 59, 0.10), 0px 4px 6px -2px rgba(30, 41, 59, 0.05)`. Applied to Floating Action Buttons (FAB), context dropdowns, and elevated AppBars.
- **Level 4 (Modals & Confirmation Dialogs)**: `box-shadow: 0px 20px 25px -5px rgba(30, 41, 59, 0.15), 0px 10px 10px -5px rgba(30, 41, 59, 0.04)`. Applied to high-priority verification dialogs and batch finalization sheets.

## Shapes

The design system adopts a **Soft (Level 1)** geometric standard. This provides an enterprise-focused, structured visual boundary while softening severe intersections.

- **Base Radius (0.25rem / 4px)**: Buttons, text fields, chips, table cell selection boxes, and toggle segment items.
- **Container Radius (`rounded-lg` / 0.5rem / 8px)**: Paper cards, DataGrid containers, evaluation panels, and modal dialog bodies.
- **Pill Radius (Full / 9999px)**: Reserved strictly for small status badges, circular confidence indicators, Circular Progress indicators, and Floating Action Buttons (FABs).

## Components

### Buttons & Floating Action Buttons (FAB)
- **Contained Button**: Primary background (`#1976D2`), white text, 4px border radius, uppercase typography disabled in favor of subtitle2 weight with 0.025em letter-spacing. Padding: 6px 16px (dense).
- **Outlined Button**: Border `#1976D2`, background transparent, hover with 4% primary tint.
- **FAB**: Positioned at bottom-right of answer sheets for quick-action shortcuts ("Next Script", "Flag Anomaly"). 48px dense variant, secondary amber (`#FFA000`) or primary blue with Level 3 elevation.

### DataGrid & Tables
- **Header**: Height 40px, background `#F8FAFC`, text `#64748B`, font-size 12px, font-weight 600, uppercase overline styling, divided by 1px solid `#E2E8F0`.
- **Rows**: High-density 44px standard row height. Hover state utilizes `#F1F5F9`. Selected state marked by a 3px solid `#1976D2` vertical border on the leading cell edge.
- **Data Cells**: Monospaced tabular figures for numerical grade totals, question weights, and confidence percentages.

### Text Fields & Inputs
- **Outlined Variant**: Default border color `#E2E8F0`, transition to `#1976D2` with 2px stroke on focus.
- **Score Input Boxes**: Compact 36px height with right-aligned numeric inputs, font-weight 600, font-size 14px, supporting rapid keyboard entry with automated Tab traversal.

### ToggleButtonGroup
- Bordered horizontal clusters for grading metrics (e.g., [Correct | Partial | Incorrect] or [0 | 1 | 2 | 3 | 4 | 5]).
- Selected toggle inherits Primary light fill (`#E3F2FD`) with `#1976D2` text and border accent.

### Chips & Status Badges
- **AI Confidence Indicators**: Dense height (20px), text size 11px.
  - High (>90%): Background `#E8F5E9`, text `#2E7D32`.
  - Medium (70-90%): Background `#FFF8E1`, text `#B78103`.
  - Low / Flagged (<70%): Background `#FFEBEE`, text `#D32F2F`.
- **Badges**: Overlapping dot or small count indicators positioned on icon buttons in the App Bar (unprocessed scripts, flagged errors).

### Progress Indicators
- **Linear Progress**: 4px height bar docked immediately below the primary App Bar to indicate batch background processing and OCR ingestion progress without interrupting interaction.
- **Circular Progress**: Sized to 16px for inline button loading states, and 40px with score percentage center-text for whole-script AI completion reviews.

### Navigation Drawer & App Bar
- **App Bar**: Dense 48px height, surface background (`#FFFFFF`), border-bottom 1px solid `#E2E8F0`, zero shadow when static, Level 2 elevation on scroll.
- **Permanent Left Drawer**: 240px wide, solid surface (`#FFFFFF`) with 1px right border (`#E2E8F0`). Selected tree items highlighted with `#E3F2FD` background and `#1976D2` text.

### Dialogs & Modals
- Bounded to max-width 560px for confirmation tasks; max-width 1024px for side-by-side audit logs. Padding: 20px on dialog content; explicit separator lines above actions.