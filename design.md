# Project Maker Design System

Status: **locked application-wide source of truth**
Owner: Project Maker product design
Last updated: 2026-08-23
Applies to: the Angular web application, authentication shell, navigation shell, feature pages, and shared components

Future Hallmark work must read this file before proposing page-level changes. Page briefs may choose composition and content density, but they may not introduce a parallel palette, typography system, logo treatment, navigation grammar, or motion language.

## 1. Design direction

Project Maker is a **nocturnal control room for project preparation**: precise, alive, and directional without looking theatrical. The interface should make the preparation journey feel visible and navigable, as though scattered discovery converges into a decision and then into an executable project.

| Hallmark dimension | Locked choice |
| --- | --- |
| Genre | Atmospheric |
| Macrostructure | Workbench |
| Navigation | N11 mega-menu, adapted as an opaque control panel |
| Theme | Custom: nocturnal control room / sharp convergence |
| Theme axes | Dark-default + true light / geometric sans / cool |
| Primary color role | Blue = structure, navigation, active system state |
| Restricted semantic roles | Magenta = discovery; yellow = decision and focus |
| Display type | Bricolage Grotesque Variable |
| Body and UI type | IBM Plex Sans Variable |
| Primary viewport | Desktop, 1024 px and wider |
| Compact safety range | Shell and authentication must remain usable at 320–768 px |

“Atmospheric” describes depth, hierarchy, and spatial tension here. It does **not** authorize ambient blooms, decorative glows, glass panels, gradient headings, or autonomous animation.

## 2. Product language

Keep established Project Maker domain terms intact. Visual redesign is not permission to rename domain concepts or turn professional workflow language into marketing copy.

- The user belongs to an **Operator organization**.
- A **Project Idea** begins the **Project preparation journey**.
- Preparation is organized through **Discovery**, **Decision**, and the downstream project workflow already present in the product.
- The guided feeling comes from sequence, spatial hierarchy, status, and progressive disclosure—not from an invented onboarding narrative or a fake “AI assistant tour.”
- Use real Project Maker UI and real states in workbench presentations. Do not place product screenshots inside fake browser or device chrome.

## 3. Identity: the convergence mark

The Project Maker mark is a sharp, compact convergence symbol:

1. A structural blue trajectory establishes the route.
2. A shorter magenta branch represents discovery entering the route.
3. Both resolve at a yellow decision point.
4. The resulting silhouette points forward and remains legible at favicon size.

The mark must work as a single-color cutout as well as in the three-role color version. Geometry is angular, balanced, and intentional; no soft blob, generic spark, isolated letter “P,” cube, or infinity loop. The mark is static. Color separation—not glow or animation—carries the concept.

The wordmark uses Bricolage Grotesque Variable at a firm weight with tight tracking. “Project Maker” stays readable; it is not compressed into an acronym in the primary lockup.

## 4. Color system

All application color must resolve through named role tokens. Do not use raw palette values inside feature styles. The dark theme is the default; the light theme is a complete theme, not an inverted afterthought. Both themes preserve the same semantic hues.

### Role usage

| Role | Dark | Light | Purpose |
| --- | --- | --- | --- |
| `paper` | `oklch(12% 0.022 265)` | `oklch(97% 0.009 255)` | Page canvas |
| `paper-2` | `oklch(16% 0.026 265)` | `oklch(94.5% 0.012 255)` | Shell and secondary region |
| `paper-3` | `oklch(21% 0.030 265)` | `oklch(91% 0.016 255)` | Raised/selected region |
| `rule` | `oklch(34% 0.034 260)` | `oklch(74% 0.028 255)` | Strong structural divider |
| `rule-2` | `oklch(27% 0.030 262)` | `oklch(84% 0.022 255)` | Default border |
| `control-border` | `oklch(52% 0.032 258)` | `oklch(56% 0.030 258)` | Perceivable form-control boundary |
| `muted` | `oklch(70% 0.030 255)` | `oklch(43% 0.032 260)` | Secondary readable text |
| `neutral` | `oklch(50% 0.032 258)` | `oklch(56% 0.030 258)` | Disabled/inactive state |
| `ink-2` | `oklch(80% 0.022 255)` | `oklch(31% 0.028 260)` | Supporting text |
| `ink` | `oklch(95% 0.012 250)` | `oklch(18% 0.025 265)` | Primary text |
| `accent` | `oklch(72% 0.170 245)` | `oklch(51% 0.190 252)` | Structural blue, primary action, active route |
| `accent-ink` | `oklch(13% 0.025 265)` | `oklch(97% 0.009 255)` | Text/icon on structural blue |
| `discovery` | `oklch(72% 0.200 328)` | `oklch(50% 0.220 328)` | Discovery state and branch only |
| `decision` | `oklch(88% 0.170 96)` | `oklch(60% 0.150 90)` | Decision state, decisive checkpoint |
| `decision-text` | `oklch(88% 0.170 96)` | `oklch(51% 0.150 90)` | Accessible yellow label text on theme surfaces |
| `focus` | `oklch(88% 0.190 96)` | `oklch(54% 0.180 90)` | Keyboard focus ring |
| `success` | `oklch(74% 0.150 150)` | `oklch(46% 0.140 150)` | Successful outcome |
| `warning` | `oklch(82% 0.150 82)` | `oklch(52% 0.140 78)` | Warning |
| `danger` | `oklch(70% 0.190 28)` | `oklch(50% 0.190 28)` | Destructive/error state |

Blue owns the broadest chromatic footprint. Magenta and yellow are domain signals, not alternate decorative accents. A surface should normally show one dominant chromatic role; discovery and decision colors may meet only where the journey relationship itself is being explained.

## 5. Typography

- **Display and wordmark:** `"Bricolage Grotesque Variable"`, fallback `"Arial Narrow"`, `ui-sans-serif`, `sans-serif`.
- **Body, controls, labels, and technical values:** `"IBM Plex Sans Variable"`, fallback `"Segoe UI"`, `ui-sans-serif`, `sans-serif`.
- Keep the system to these two families. Technical values use tabular figures instead of introducing a third monospace family.
- Display headings are roman, tight, and decisive: weight 720, tracking `-0.035em`, line height `0.98–1.08`.
- Body copy is weight 400–450 with line height `1.5–1.65`.
- Labels may use weight 600 and modest tracking up to `0.04em`; do not turn every section label into an uppercase eyebrow ornament.
- Heading color is solid `ink`. Gradient text is prohibited.

## 6. Shape, spacing, and depth

- Use the 4 px spacing seed expressed through the tokens below.
- Prefer cut planes, rules, alignment, and small radius changes over floating cards.
- Card and control radii are `0.25rem`. Pills are reserved for status, compact counts, and binary segmented controls.
- Elevation is rare. A restrained neutral shadow may identify one truly overlaid control; never tint a shadow into a glow.
- Borders are functional: they explain zones, selection, or hierarchy. Avoid boxing every paragraph.

## 7. Workbench macrostructure

The application shell and major preparation pages use a Workbench rhythm:

1. **Functional heading:** page name, current project context, status, and the next meaningful action.
2. **Workspace map:** a concise, spatial view of the Project preparation journey. It reveals the route and current position once when meaningful, then remains stable.
3. **Primary work zone:** real forms, records, evidence, decisions, and project UI.
4. **Context rail or support zone:** history, guidance, metadata, or actions that support the active task.
5. **Resolution:** a clear saved/ready/blocked state and the next route.

Desktop compositions may be asymmetrical, but the reading order must remain obvious. The “magába szippant” quality comes from visible progress, strong direction, and controlled transitions—not from decorative spectacle.

## 8. N11 navigation adaptation

Use an N11 mega-menu for the desktop shell, with these Project Maker-specific constraints:

- The closed bar is compact and stable; the active destination uses blue structure color and a shape/weight cue.
- The open panel is opaque `paper-2`/`paper-3`, full-width within the shell, and at most four columns or 60 vh high.
- Group destinations by existing product areas and domain labels. Do not create vague marketing categories.
- A dim scrim may clarify modality. Backdrop blur and glass are prohibited.
- Open by click and keyboard. Hover may be an enhancement only and must include a close grace period.
- Only one panel is open at a time. `Escape` closes and returns focus to the trigger. Triggers expose `aria-expanded` and `aria-controls`.
- In the 320–768 px range, replace the mega panel with a drawer/accordion pattern. The compact shell must not horizontally scroll.

## 9. Theme behavior

- First visit uses dark theme unless the product already has a stored explicit user choice.
- Users can choose dark or light from an accessible labeled control; icon-only sun/moon affordances require an accessible name and state.
- Persist an explicit choice and apply it before the application paints when platform constraints allow, avoiding a theme flash.
- Apply exactly one root class: `pm-dark` or `pm-light`. Components consume semantic tokens only.
- Native form controls receive the matching `color-scheme`.
- Light theme preserves depth through ink, rule, and paper relationships. It does not replace navy with pure white or neon colors with pastels.

## 10. Motion contract

Motion is allowed only for:

1. **Workspace map reveal:** a one-time opacity/translate reveal that explains sequence.
2. **Route transition:** a short opacity/translate handoff that maintains spatial continuity.
3. **Direct control feedback:** press, expand/collapse, selection, validation, and focus response.

Use only `transform` and `opacity`. No ambient infinite animation, animated background, floating particle, pulsing glow, looping scan line, or autonomous carousel. Reduced-motion mode removes spatial travel and caps feedback at 150 ms opacity changes.

## 11. Responsive and accessibility requirements

- Design the full Workbench for 1024 px and wider.
- At 768 px and below, collapse multi-column work zones and use compact navigation.
- At 320, 375, 414, and 768 px, the shell and authentication flow must remain operable without horizontal scrolling, clipped actions, or inaccessible dialogs.
- Keep focus visible with the yellow focus role and a non-color shape/rule change where practical.
- Normal text targets WCAG AA contrast. Muted text is still readable text, never disabled-gray decoration.
- Interactive targets are at least 44 × 44 px on compact layouts; desktop pointer targets may be denser only when keyboard equivalents remain clear.
- Do not encode Discovery, Decision, success, warning, or danger by color alone. Pair them with text, icon, position, or shape.
- Preserve logical DOM order when visual layout changes.

## 12. Explicit exclusions

Do not introduce:

- glassmorphism, backdrop blur, translucent glass cards, or frosted mega-menus;
- decorative glow, neon bloom, aurora, or halo effects;
- gradient headings or ornamental eyebrow labels;
- ambient or infinite motion;
- fake browser/device chrome around product UI;
- excessive rounded cards or pill-shaped primary buttons;
- a second page-local theme, palette, font stack, logo, or motion grammar;
- renamed Project Maker domain concepts for visual novelty.

## 13. Canonical token exports

The following four formats express the same locked semantic system. The Angular application remains SCSS/PrimeNG; Tailwind and shadcn blocks are portability mappings, not framework migration instructions.

### Format 1 — `tokens.css` source specification

This block is the portable core of the implemented root `tokens.css`; the application file also contains the required Project Maker compatibility aliases and elevation roles.

```css
:root,
.pm-dark {
  color-scheme: dark;

  --color-paper: oklch(12% 0.022 265);
  --color-paper-2: oklch(16% 0.026 265);
  --color-paper-3: oklch(21% 0.03 265);
  --color-rule: oklch(34% 0.034 260);
  --color-rule-2: oklch(27% 0.03 262);
  --color-control-border: oklch(52% 0.032 258);
  --color-muted: oklch(70% 0.03 255);
  --color-neutral: oklch(50% 0.032 258);
  --color-ink-2: oklch(80% 0.022 255);
  --color-ink: oklch(95% 0.012 250);
  --color-accent: oklch(72% 0.17 245);
  --color-accent-ink: oklch(13% 0.025 265);
  --color-discovery: oklch(72% 0.2 328);
  --color-decision: oklch(88% 0.17 96);
  --color-decision-text: oklch(88% 0.17 96);
  --color-focus: oklch(88% 0.19 96);
  --color-success: oklch(74% 0.15 150);
  --color-warning: oklch(82% 0.15 82);
  --color-danger: oklch(70% 0.19 28);

  --font-display: "Bricolage Grotesque Variable", "Arial Narrow", ui-sans-serif, sans-serif;
  --font-body: "IBM Plex Sans Variable", "Segoe UI", ui-sans-serif, sans-serif;
  --font-wordmark: var(--font-display);

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-md: 1.25rem;
  --text-lg: 1.5625rem;
  --text-xl: 1.9531rem;
  --text-2xl: 2.4414rem;
  --text-display: clamp(2.5rem, 4vw + 1rem, 4.5rem);

  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  --space-2xl: 4.5rem;
  --space-3xl: 7rem;

  --radius-card: 0.25rem;
  --radius-control: 0.25rem;
  --radius-pill: 999px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --duration-micro: 120ms;
  --duration-short: 220ms;
  --duration-long: 320ms;
  --shadow-overlay: 0 1rem 2.5rem oklch(4% 0.02 265 / 0.32);
}

.pm-light {
  color-scheme: light;

  --color-paper: oklch(97% 0.009 255);
  --color-paper-2: oklch(94.5% 0.012 255);
  --color-paper-3: oklch(91% 0.016 255);
  --color-rule: oklch(74% 0.028 255);
  --color-rule-2: oklch(84% 0.022 255);
  --color-control-border: oklch(56% 0.03 258);
  --color-muted: oklch(43% 0.032 260);
  --color-neutral: oklch(56% 0.03 258);
  --color-ink-2: oklch(31% 0.028 260);
  --color-ink: oklch(18% 0.025 265);
  --color-accent: oklch(51% 0.19 252);
  --color-accent-ink: oklch(97% 0.009 255);
  --color-discovery: oklch(50% 0.22 328);
  --color-decision: oklch(60% 0.15 90);
  --color-decision-text: oklch(51% 0.15 90);
  --color-focus: oklch(54% 0.18 90);
  --color-success: oklch(46% 0.14 150);
  --color-warning: oklch(52% 0.14 78);
  --color-danger: oklch(50% 0.19 28);
  --shadow-overlay: 0 1rem 2.5rem oklch(18% 0.025 265 / 0.14);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-micro: 80ms;
    --duration-short: 120ms;
    --duration-long: 150ms;
  }
}
```

### Format 2 — Tailwind CSS v4 mapping

```css
@theme {
  --color-paper: oklch(12% 0.022 265);
  --color-paper-2: oklch(16% 0.026 265);
  --color-paper-3: oklch(21% 0.03 265);
  --color-rule: oklch(34% 0.034 260);
  --color-rule-2: oklch(27% 0.03 262);
  --color-control-border: oklch(52% 0.032 258);
  --color-muted: oklch(70% 0.03 255);
  --color-neutral: oklch(50% 0.032 258);
  --color-ink-2: oklch(80% 0.022 255);
  --color-ink: oklch(95% 0.012 250);
  --color-accent: oklch(72% 0.17 245);
  --color-accent-ink: oklch(13% 0.025 265);
  --color-discovery: oklch(72% 0.2 328);
  --color-decision: oklch(88% 0.17 96);
  --color-decision-text: oklch(88% 0.17 96);
  --color-focus: oklch(88% 0.19 96);
  --color-success: oklch(74% 0.15 150);
  --color-warning: oklch(82% 0.15 82);
  --color-danger: oklch(70% 0.19 28);

  --font-display: "Bricolage Grotesque Variable", "Arial Narrow", ui-sans-serif, sans-serif;
  --font-sans: "IBM Plex Sans Variable", "Segoe UI", ui-sans-serif, sans-serif;

  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --spacing-2xl: 4.5rem;
  --spacing-3xl: 7rem;

  --radius-card: 0.25rem;
  --radius-control: 0.25rem;
  --animate-duration-micro: 120ms;
  --animate-duration-short: 220ms;
  --animate-duration-long: 320ms;
  --ease-control-out: cubic-bezier(0.16, 1, 0.3, 1);
}

.pm-light {
  --color-paper: oklch(97% 0.009 255);
  --color-paper-2: oklch(94.5% 0.012 255);
  --color-paper-3: oklch(91% 0.016 255);
  --color-rule: oklch(74% 0.028 255);
  --color-rule-2: oklch(84% 0.022 255);
  --color-control-border: oklch(56% 0.03 258);
  --color-muted: oklch(43% 0.032 260);
  --color-neutral: oklch(56% 0.03 258);
  --color-ink-2: oklch(31% 0.028 260);
  --color-ink: oklch(18% 0.025 265);
  --color-accent: oklch(51% 0.19 252);
  --color-accent-ink: oklch(97% 0.009 255);
  --color-discovery: oklch(50% 0.22 328);
  --color-decision: oklch(60% 0.15 90);
  --color-decision-text: oklch(51% 0.15 90);
  --color-focus: oklch(54% 0.18 90);
  --color-success: oklch(46% 0.14 150);
  --color-warning: oklch(52% 0.14 78);
  --color-danger: oklch(50% 0.19 28);
}
```

### Format 3 — DTCG JSON

```json
{
  "$schema": "https://www.designtokens.org/schemas/2025.10/format.schema.json",
  "theme": {
    "dark": {
      "color": {
        "$type": "color",
        "paper": { "$value": { "colorSpace": "oklch", "components": [0.12, 0.022, 265], "alpha": 1 } },
        "paper-2": { "$value": { "colorSpace": "oklch", "components": [0.16, 0.026, 265], "alpha": 1 } },
        "paper-3": { "$value": { "colorSpace": "oklch", "components": [0.21, 0.03, 265], "alpha": 1 } },
        "rule": { "$value": { "colorSpace": "oklch", "components": [0.34, 0.034, 260], "alpha": 1 } },
        "rule-2": { "$value": { "colorSpace": "oklch", "components": [0.27, 0.03, 262], "alpha": 1 } },
        "control-border": { "$value": { "colorSpace": "oklch", "components": [0.52, 0.032, 258], "alpha": 1 } },
        "muted": { "$value": { "colorSpace": "oklch", "components": [0.70, 0.03, 255], "alpha": 1 } },
        "neutral": { "$value": { "colorSpace": "oklch", "components": [0.50, 0.032, 258], "alpha": 1 } },
        "ink-2": { "$value": { "colorSpace": "oklch", "components": [0.80, 0.022, 255], "alpha": 1 } },
        "ink": { "$value": { "colorSpace": "oklch", "components": [0.95, 0.012, 250], "alpha": 1 } },
        "accent": { "$value": { "colorSpace": "oklch", "components": [0.72, 0.17, 245], "alpha": 1 } },
        "accent-ink": { "$value": { "colorSpace": "oklch", "components": [0.13, 0.025, 265], "alpha": 1 } },
        "discovery": { "$value": { "colorSpace": "oklch", "components": [0.72, 0.20, 328], "alpha": 1 } },
        "decision": { "$value": { "colorSpace": "oklch", "components": [0.88, 0.17, 96], "alpha": 1 } },
        "decision-text": { "$value": { "colorSpace": "oklch", "components": [0.88, 0.17, 96], "alpha": 1 } },
        "focus": { "$value": { "colorSpace": "oklch", "components": [0.88, 0.19, 96], "alpha": 1 } },
        "success": { "$value": { "colorSpace": "oklch", "components": [0.74, 0.15, 150], "alpha": 1 } },
        "warning": { "$value": { "colorSpace": "oklch", "components": [0.82, 0.15, 82], "alpha": 1 } },
        "danger": { "$value": { "colorSpace": "oklch", "components": [0.70, 0.19, 28], "alpha": 1 } }
      }
    },
    "light": {
      "color": {
        "$type": "color",
        "paper": { "$value": { "colorSpace": "oklch", "components": [0.97, 0.009, 255], "alpha": 1 } },
        "paper-2": { "$value": { "colorSpace": "oklch", "components": [0.945, 0.012, 255], "alpha": 1 } },
        "paper-3": { "$value": { "colorSpace": "oklch", "components": [0.91, 0.016, 255], "alpha": 1 } },
        "rule": { "$value": { "colorSpace": "oklch", "components": [0.74, 0.028, 255], "alpha": 1 } },
        "rule-2": { "$value": { "colorSpace": "oklch", "components": [0.84, 0.022, 255], "alpha": 1 } },
        "control-border": { "$value": { "colorSpace": "oklch", "components": [0.56, 0.03, 258], "alpha": 1 } },
        "muted": { "$value": { "colorSpace": "oklch", "components": [0.43, 0.032, 260], "alpha": 1 } },
        "neutral": { "$value": { "colorSpace": "oklch", "components": [0.56, 0.03, 258], "alpha": 1 } },
        "ink-2": { "$value": { "colorSpace": "oklch", "components": [0.31, 0.028, 260], "alpha": 1 } },
        "ink": { "$value": { "colorSpace": "oklch", "components": [0.18, 0.025, 265], "alpha": 1 } },
        "accent": { "$value": { "colorSpace": "oklch", "components": [0.51, 0.19, 252], "alpha": 1 } },
        "accent-ink": { "$value": { "colorSpace": "oklch", "components": [0.97, 0.009, 255], "alpha": 1 } },
        "discovery": { "$value": { "colorSpace": "oklch", "components": [0.50, 0.22, 328], "alpha": 1 } },
        "decision": { "$value": { "colorSpace": "oklch", "components": [0.60, 0.15, 90], "alpha": 1 } },
        "decision-text": { "$value": { "colorSpace": "oklch", "components": [0.51, 0.15, 90], "alpha": 1 } },
        "focus": { "$value": { "colorSpace": "oklch", "components": [0.54, 0.18, 90], "alpha": 1 } },
        "success": { "$value": { "colorSpace": "oklch", "components": [0.46, 0.14, 150], "alpha": 1 } },
        "warning": { "$value": { "colorSpace": "oklch", "components": [0.52, 0.14, 78], "alpha": 1 } },
        "danger": { "$value": { "colorSpace": "oklch", "components": [0.50, 0.19, 28], "alpha": 1 } }
      }
    }
  },
  "font": {
    "display": { "$type": "fontFamily", "$value": ["Bricolage Grotesque Variable", "Arial Narrow", "sans-serif"] },
    "body": { "$type": "fontFamily", "$value": ["IBM Plex Sans Variable", "Segoe UI", "sans-serif"] }
  },
  "space": {
    "$type": "dimension",
    "3xs": { "$value": { "value": 0.25, "unit": "rem" } },
    "2xs": { "$value": { "value": 0.5, "unit": "rem" } },
    "xs": { "$value": { "value": 0.75, "unit": "rem" } },
    "sm": { "$value": { "value": 1, "unit": "rem" } },
    "md": { "$value": { "value": 1.5, "unit": "rem" } },
    "lg": { "$value": { "value": 2, "unit": "rem" } },
    "xl": { "$value": { "value": 3, "unit": "rem" } },
    "2xl": { "$value": { "value": 4.5, "unit": "rem" } },
    "3xl": { "$value": { "value": 7, "unit": "rem" } }
  },
  "duration": {
    "$type": "duration",
    "micro": { "$value": { "value": 120, "unit": "ms" } },
    "short": { "$value": { "value": 220, "unit": "ms" } },
    "long": { "$value": { "value": 320, "unit": "ms" } }
  }
}
```

### Format 4 — shadcn dark/light mapping

Values below are OKLCH component triples for consumers that wrap them with `oklch(var(--token))`.

```css
:root,
.dark,
.pm-dark {
  --background: 0.12 0.022 265;
  --foreground: 0.95 0.012 250;
  --card: 0.16 0.026 265;
  --card-foreground: 0.95 0.012 250;
  --popover: 0.21 0.03 265;
  --popover-foreground: 0.95 0.012 250;
  --primary: 0.72 0.17 245;
  --primary-foreground: 0.13 0.025 265;
  --secondary: 0.21 0.03 265;
  --secondary-foreground: 0.80 0.022 255;
  --muted: 0.21 0.03 265;
  --muted-foreground: 0.70 0.03 255;
  --accent: 0.21 0.03 265;
  --accent-foreground: 0.95 0.012 250;
  --destructive: 0.70 0.19 28;
  --destructive-foreground: 0.13 0.025 265;
  --border: 0.27 0.03 262;
  --input: 0.52 0.032 258;
  --ring: 0.88 0.19 96;
  --discovery: 0.72 0.20 328;
  --decision: 0.88 0.17 96;
  --decision-text: 0.88 0.17 96;
  --success: 0.74 0.15 150;
  --warning: 0.82 0.15 82;
}

.pm-light {
  --background: 0.97 0.009 255;
  --foreground: 0.18 0.025 265;
  --card: 0.945 0.012 255;
  --card-foreground: 0.18 0.025 265;
  --popover: 0.91 0.016 255;
  --popover-foreground: 0.18 0.025 265;
  --primary: 0.51 0.19 252;
  --primary-foreground: 0.97 0.009 255;
  --secondary: 0.91 0.016 255;
  --secondary-foreground: 0.31 0.028 260;
  --muted: 0.91 0.016 255;
  --muted-foreground: 0.43 0.032 260;
  --accent: 0.91 0.016 255;
  --accent-foreground: 0.18 0.025 265;
  --destructive: 0.50 0.19 28;
  --destructive-foreground: 0.97 0.009 255;
  --border: 0.84 0.022 255;
  --input: 0.56 0.03 258;
  --ring: 0.54 0.18 90;
  --discovery: 0.50 0.22 328;
  --decision: 0.60 0.15 90;
  --decision-text: 0.51 0.15 90;
  --success: 0.46 0.14 150;
  --warning: 0.52 0.14 78;
}
```

## 14. Governance rule

Any implementation departure from this document must be explicit and justified by a product, accessibility, or platform constraint. Record durable changes in `design-system/project-maker/MASTER.md` and prepend a corresponding entry to `.hallmark/log.json`.
