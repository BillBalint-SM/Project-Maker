# Project Maker Design System

Status: locked production direction

Selected: 2026-08-24
Authority: this file defines the visual and interaction system for the Project Maker web application.

## 1. Product position

Project Maker is a preparation journey, not a generic project dashboard. Its interface should let an operator answer three questions immediately:

1. Where is each project in preparation?
2. Which project needs attention now?
3. What is the canonical next action?

The production core is **B — Journey Field**. The separate **Queue** view keeps the dense operational logic of direction D for power users, but it uses the same B typography, color, shape, focus, and motion system. D does not introduce a second visual theme.

## 2. Locked Hallmark selection

| Axis | Selection |
|---|---|
| Verb | Redesign |
| Scope | Application shell, Portfolio core, Queue power view |
| Genre | Atmospheric |
| Core macrostructure | Map / Diagram |
| Queue macrostructure | Dense operational table with Bento information logic |
| Navigation | N4: visible Navigate trigger plus Control/Command K |
| Footer | None; this is an application shell |
| Theme | Midnight, dark by default with a complete light pair |
| Type | Tomorrow display + IBM Plex Sans body |
| Enrichment | None |
| Motion | One route reveal, selection feedback, direct control feedback |

The atmospheric quality comes from spatial sequencing, deep tinted surfaces, decisive contrast, and controlled neon signals. It does not come from glass, glow clouds, looping particles, fake terminal chrome, or gradient headlines.

## 3. Identity: the Journey Mark

The Project Maker mark is a rising route with three preparation nodes and a forward corner.

- The route expresses movement through preparation.
- The first magenta node represents discovery.
- The cyan node represents active movement.
- The yellow node represents decision and readiness.
- The arrow corner expresses a concrete next action.
- A dark under-stroke keeps the mark legible in both themes and at favicon size.

The primary wordmark reads “Project Maker” in Tomorrow at 600. Do not compress it to an acronym in the main shell.

## 4. Color system

All production views use this single role system.

### 4.1 Dark — default

| Role | Value | Use |
|---|---|---|
| Paper | `oklch(12% 0.03 255)` | Main canvas |
| Paper deep | `oklch(8% 0.028 255)` | Shell and route field |
| Paper 2 | `oklch(17% 0.038 255)` | Primary surfaces |
| Paper 3 | `oklch(23% 0.045 252)` | Raised controls |
| Ink | `oklch(95% 0.012 235)` | Primary text |
| Ink 2 | `oklch(81% 0.03 225)` | Secondary text |
| Muted | `oklch(70% 0.035 230)` | Supporting copy |
| Rule | `oklch(45% 0.07 225)` | Strong separators |
| Rule 2 | `oklch(31% 0.055 245)` | Quiet separators |
| Accent | `oklch(78% 0.15 195)` | Route, primary action, selected state |
| Accent ink | `oklch(12% 0.03 255)` | Text on accent |
| Discovery | `oklch(74% 0.19 328)` | Discovery signal only |
| Decision/focus | `oklch(86% 0.17 95)` | Decision and focus |
| Success | `oklch(76% 0.14 155)` | Confirmed success |
| Warning | `oklch(82% 0.15 82)` | Warning |
| Danger | `oklch(71% 0.19 28)` | Error and destructive state |

### 4.2 Light

| Role | Value |
|---|---|
| Paper | `oklch(98% 0.012 235)` |
| Paper deep | `oklch(91% 0.026 238)` |
| Paper 2 | `oklch(94% 0.02 235)` |
| Paper 3 | `oklch(89% 0.03 232)` |
| Ink | `oklch(16% 0.035 255)` |
| Ink 2 | `oklch(30% 0.04 250)` |
| Muted | `oklch(42% 0.045 245)` |
| Rule | `oklch(58% 0.065 235)` |
| Rule 2 | `oklch(78% 0.04 235)` |
| Accent | `oklch(40% 0.15 225)` |
| Accent ink | `oklch(98% 0.012 235)` |
| Discovery | `oklch(43% 0.17 328)` |
| Decision | `oklch(40% 0.13 85)` |
| Focus | `oklch(43% 0.19 275)` |
| Success | `oklch(39% 0.13 155)` |
| Warning | `oklch(40% 0.13 76)` |
| Danger | `oklch(43% 0.19 28)` |

### 4.3 Footprint rules

- Accent occupies no more than roughly five percent of a normal viewport outside the Journey route.
- Magenta never becomes a general secondary button color.
- Yellow is reserved for decision semantics, focus, and exceptional attention.
- Color never carries state by itself; pair it with text, count, shape, or position.
- Never use pure black or pure white as a base surface.

## 5. Typography

- Display and wordmark: `"Tomorrow"`, weights 500–700.
- Body and UI: `"IBM Plex Sans Variable"`, weights 400–700.
- Technical values use IBM Plex Sans with tabular numerals; there is no third non-code face.
- Display headings are roman, balanced where supported, and use line-height 1.04 or greater.
- Body copy uses 1.5–1.65 line-height and a 45–75 character measure.
- Labels use restrained tracking; do not turn every section title into an all-caps eyebrow pair.

## 6. Shape, space, and depth

- Spacing follows the named four-pixel-derived scale in `tokens.css`.
- Card radius: 12 px.
- Control radius: 8 px.
- Pills are reserved for true compact statuses.
- Use fine tinted rules before shadows. Shadows distinguish overlays and selected depth only.
- Avoid card nesting. Journey nodes are controls on a route, not cards inside a hero card.

## 7. Core: Journey Field

The Portfolio route is the spatial home of the product.

- Position projects only from `ProjectWorkState.preparationStatus.state`.
- The six positions are Schema required, Intake in progress, Clarification required, Decision Review required, Estimate preparable, and Estimate ready.
- Never infer position from administrative project status, health, readiness percentage, or decision score.
- The map declares its scope: current filtered page, current page number, and total matching count.
- A selected node reveals only canonical data: preparation label, urgency, next action, owner, due date, factual progress, and primary action.
- Projects without a preparation state are not placed at a fabricated position; show an honest unavailable count.
- The register beneath the field remains a secondary browse surface.

## 8. Power view: Queue

Queue is a separate route for operators who value scanning speed and density.

- Use the existing active-queue endpoint, server counts, URL filters, cursors, retry behavior, and stale-data behavior.
- Group rows by urgency in the server-defined order.
- Present a semantic data table on wide screens and a label/value row layout on compact screens.
- Metrics may show only real `totalCount` and `groupCounts`; no decorative percentages or synthetic velocity scores.
- Journey and Queue are peer views of the same work and always share the Midnight palette.

## 9. Navigation

Navigation uses N4 behavior:

- A visible **Navigate** control is always present for discovery.
- Control K and Command K open the same surface and move focus to its first destination.
- Escape closes it and restores focus to the trigger.
- The panel groups Orient, Move, and Configure destinations; it is opaque and readable in both themes.
- Current-route state uses text, border, and a narrow cyan signal.
- Compact layouts preserve the same destinations and do not rely on hover.

## 10. Theme behavior

- Dark is the first-visit default.
- The user can explicitly select light or dark.
- The choice persists through the existing theme state.
- Both themes map the same semantic roles; components never branch on raw color values.
- PrimeNG consumes the same role system through `app.theme.ts`.

## 11. Motion

Only three motion families are allowed:

1. Journey canvas: a single opacity/vertical arrival when real data appears.
2. Selection and row feedback: background and border-color changes.
3. Route transitions: the existing short directional view transition.

No motion may change layout geometry. Every transform or animation has a `prefers-reduced-motion` fallback. Focus rings appear immediately.

## 12. Responsive and accessibility contract

- No document-level horizontal scroll from 320 px through 1920 px.
- Test 320, 375, 414, 768, 1280×800, and 1440 widths.
- Journey stages reflow from six to three to one column without changing semantic order.
- Queue becomes a label/value layout before the table would overflow.
- Interactive controls are at least 44 CSS px high where practical and at least 24×24 CSS px everywhere.
- Every control has visible hover, focus-visible, active, and disabled treatment through the shared state layer.
- Normal text meets WCAG 2.1 AA 4.5:1; large text, icons, boundaries, and focus indicators meet 3:1.
- Keyboard focus is not obscured by the sticky shell or navigation surface.
- Project names may truncate only where the full name remains available through the accessible label and title.
- Dark and light are verified independently.

## 13. Explicit exclusions

Do not introduce:

- cyan-to-magenta gradients or gradient text;
- glassmorphism, backdrop blur as decoration, bloom clouds, or ambient glow;
- fake browser, terminal, phone, or IDE chrome;
- looping route animation, parallax, or particle systems;
- emoji as structural icons;
- a second green/terminal palette for Queue;
- fabricated product metrics or fake global completion percentages;
- generic hero → three cards → CTA structures.

## 14. Canonical exports

The executable source of truth is [`tokens.css`](tokens.css). The mappings below preserve the same semantic roles for other toolchains.

### 14.1 CSS

```css
:root,
.pm-dark {
  --color-paper: oklch(12% 0.03 255);
  --color-paper-deep: oklch(8% 0.028 255);
  --color-paper-2: oklch(17% 0.038 255);
  --color-paper-3: oklch(23% 0.045 252);
  --color-ink: oklch(95% 0.012 235);
  --color-ink-2: oklch(81% 0.03 225);
  --color-muted: oklch(70% 0.035 230);
  --color-rule: oklch(45% 0.07 225);
  --color-rule-2: oklch(31% 0.055 245);
  --color-accent: oklch(78% 0.15 195);
  --color-accent-ink: oklch(12% 0.03 255);
  --color-discovery: oklch(74% 0.19 328);
  --color-decision: oklch(86% 0.17 95);
  --color-focus: oklch(86% 0.17 95);
}

.pm-light {
  --color-paper: oklch(98% 0.012 235);
  --color-paper-deep: oklch(91% 0.026 238);
  --color-paper-2: oklch(94% 0.02 235);
  --color-paper-3: oklch(89% 0.03 232);
  --color-ink: oklch(16% 0.035 255);
  --color-ink-2: oklch(30% 0.04 250);
  --color-muted: oklch(42% 0.045 245);
  --color-rule: oklch(58% 0.065 235);
  --color-rule-2: oklch(78% 0.04 235);
  --color-accent: oklch(40% 0.15 225);
  --color-accent-ink: oklch(98% 0.012 235);
  --color-discovery: oklch(43% 0.17 328);
  --color-decision: oklch(40% 0.13 85);
  --color-focus: oklch(43% 0.19 275);
}

:root {
  --font-display: "Tomorrow", "Arial Narrow", ui-sans-serif, system-ui, sans-serif;
  --font-body: "IBM Plex Sans Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
  --radius-card: 0.75rem;
  --radius-control: 0.5rem;
}
```

### 14.2 Tailwind CSS v4

```css
@theme inline {
  --color-pm-paper: var(--color-paper);
  --color-pm-paper-deep: var(--color-paper-deep);
  --color-pm-surface: var(--color-paper-2);
  --color-pm-surface-raised: var(--color-paper-3);
  --color-pm-ink: var(--color-ink);
  --color-pm-muted: var(--color-muted);
  --color-pm-rule: var(--color-rule);
  --color-pm-accent: var(--color-accent);
  --color-pm-discovery: var(--color-discovery);
  --color-pm-decision: var(--color-decision);
  --font-pm-display: var(--font-display);
  --font-pm-body: var(--font-body);
  --radius-pm-card: var(--radius-card);
  --radius-pm-control: var(--radius-control);
}
```

### 14.3 DTCG JSON

```json
{
  "color": {
    "dark": {
      "paper": { "$type": "color", "$value": "oklch(12% 0.03 255)" },
      "ink": { "$type": "color", "$value": "oklch(95% 0.012 235)" },
      "accent": { "$type": "color", "$value": "oklch(78% 0.15 195)" },
      "discovery": { "$type": "color", "$value": "oklch(74% 0.19 328)" },
      "decision": { "$type": "color", "$value": "oklch(86% 0.17 95)" }
    },
    "light": {
      "paper": { "$type": "color", "$value": "oklch(98% 0.012 235)" },
      "ink": { "$type": "color", "$value": "oklch(16% 0.035 255)" },
      "accent": { "$type": "color", "$value": "oklch(40% 0.15 225)" },
      "discovery": { "$type": "color", "$value": "oklch(43% 0.17 328)" },
      "decision": { "$type": "color", "$value": "oklch(40% 0.13 85)" }
    }
  },
  "font": {
    "display": { "$type": "fontFamily", "$value": ["Tomorrow", "Arial Narrow", "sans-serif"] },
    "body": { "$type": "fontFamily", "$value": ["IBM Plex Sans Variable", "Segoe UI", "sans-serif"] }
  },
  "radius": {
    "card": { "$type": "dimension", "$value": "0.75rem" },
    "control": { "$type": "dimension", "$value": "0.5rem" }
  }
}
```

### 14.4 shadcn-compatible roles

```css
:root {
  --background: oklch(98% 0.012 235);
  --foreground: oklch(16% 0.035 255);
  --card: oklch(94% 0.02 235);
  --card-foreground: oklch(16% 0.035 255);
  --primary: oklch(40% 0.15 225);
  --primary-foreground: oklch(98% 0.012 235);
  --muted: oklch(89% 0.03 232);
  --muted-foreground: oklch(42% 0.045 245);
  --border: oklch(78% 0.04 235);
  --ring: oklch(43% 0.19 275);
  --radius: 0.5rem;
}

.dark {
  --background: oklch(12% 0.03 255);
  --foreground: oklch(95% 0.012 235);
  --card: oklch(17% 0.038 255);
  --card-foreground: oklch(95% 0.012 235);
  --primary: oklch(78% 0.15 195);
  --primary-foreground: oklch(12% 0.03 255);
  --muted: oklch(23% 0.045 252);
  --muted-foreground: oklch(70% 0.035 230);
  --border: oklch(31% 0.055 245);
  --ring: oklch(86% 0.17 95);
}
```

## 15. Governance

A production UI change is acceptable only when it:

1. uses the semantic roles from `tokens.css`;
2. preserves the truthful distinction between Journey position and Queue urgency;
3. supports dark and light without component-specific color branching;
4. passes focused tests, typecheck, production build, keyboard checks, responsive checks, and the Hallmark slop test;
5. updates this document when it changes a locked design decision.
