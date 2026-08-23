# Project Maker — Master Design System

Version: 2.0
Updated: 2026-08-23
Status: Active
Canonical token and export source: [`../../design.md`](../../design.md)

## 1. Authority and scope

This document turns the locked choices in `design.md` into application-level implementation rules. `design.md` wins if the two documents conflict. Page-level specifications may refine composition and content, but they may not fork the visual identity.

The system applies to:

- the public and authenticated Angular shell;
- sign-in and authentication states;
- Project Maker feature routes and shared components;
- PrimeNG component styling and application-native controls;
- responsive behavior and route/control motion;
- the Project Maker mark, wordmark, and favicon family.

The redesign preserves existing product behavior and domain vocabulary. It does not authorize workflow changes, new domain concepts, or renamed concepts.

## 2. Product character

Project Maker is a **nocturnal control room for project preparation**. Its visual signature is sharp convergence: discovery enters a structured route, decisions create direction, and the workbench makes the next meaningful action visible.

The interface should feel:

- precise rather than sterile;
- dynamic through sequence and response rather than constant animation;
- atmospheric through deep tonal hierarchy rather than effects;
- professional and domain-specific rather than generic SaaS;
- dense enough for serious work, with enough negative space to clarify priority.

The requested guided-tour feeling is a composition principle. It is not a literal scripted onboarding overlay unless a separate product requirement introduces one.

## 3. Locked Hallmark selections

| Dimension | Selection | Application rule |
| --- | --- | --- |
| Genre | Atmospheric | Use tonal depth, scale, and spatial tension; effects remain prohibited. |
| Macrostructure | Workbench | Organize major routes around context, active work, support, and resolution. |
| Navigation | N11 mega-menu | Desktop uses an opaque grouped panel; compact layouts use drawer/accordion navigation. |
| Theme | Custom | Nocturnal control room / sharp convergence. |
| Theme axes | Dark-default + light / geometric sans / cool | Both themes are complete and share semantic roles. |
| Enrichment | None | No decorative asset collection is required to carry the interface. |

## 4. Domain guardrails

Use established Project Maker terminology exactly where it expresses product meaning:

- **Operator organization** for the organization boundary;
- **Project Idea** for the initial project concept;
- **Project preparation journey** for the end-to-end preparation flow;
- **Discovery** and **Decision** as domain stages/signals where already applicable;
- the current application labels for downstream project and administration areas.

Do not substitute fashionable synonyms for domain terms. Navigation grouping must reflect real product areas, permissions, and routes.

## 5. Identity system

### 5.1 Convergence mark

The mark is constructed from angular trajectories converging at a decision point:

- structural route: blue;
- discovery branch: magenta;
- decision node: yellow;
- negative space: the active theme canvas.

The form must remain recognizable at 16 px, retain balanced weight at 24–32 px, and support a one-color version for constrained contexts. It must not depend on glow, blur, animation, or tiny internal detail. The silhouette is the identity.

Avoid generic symbols: standalone “P,” sparkle, hexagon/cube, infinity loop, brain, wand, or chatbot star.

### 5.2 Wordmark

- Typeface: Bricolage Grotesque Variable.
- Style: roman, firm weight, slightly tight tracking.
- Primary wording: “Project Maker.”
- Do not gradient-fill, bevel, glow, or animate the wordmark.
- Compact shell states may show the mark alone when an accessible product name remains available.

## 6. Color architecture

Use the semantic tokens and exact OKLCH values in `design.md`. The palette has three chromatic responsibilities:

1. **Blue / `accent`:** structural hierarchy, primary action, active route, selected system state.
2. **Magenta / `discovery`:** evidence-gathering and discovery signals only.
3. **Yellow / `decision` and `focus`:** decision checkpoints and keyboard focus.

Black/navy appears only as tinted `paper` roles, never pure black. Light surfaces are cool tinted papers, never pure white.

### 6.1 Footprint rules

- Blue may occupy controls, active navigation, and route structure.
- Magenta and yellow normally occupy small nodes, status bars, icons, or labels.
- Do not use magenta as a second primary button color.
- Do not use yellow as a large background field unless the content is specifically a decision state and contrast has been verified.
- Status colors always pair with text, icon, or shape.
- Feature CSS consumes role tokens; raw OKLCH values belong only in the canonical token layer.

### 6.2 Surface hierarchy

| Level | Role | Typical use |
| --- | --- | --- |
| Canvas | `paper` | Route background |
| Shell | `paper-2` | Navigation, side regions, grouped sections |
| Raised/active | `paper-3` | Selected row, open panel, active work zone |
| Default boundary | `rule-2` | Inputs, section dividers, inactive borders |
| Strong boundary | `rule` | Active split, important separation |

Use surface changes and rules before adding a shadow. The single neutral overlay shadow is reserved for true overlays.

## 7. Typography

### 7.1 Families

- Display, high-level page title, wordmark: `Bricolage Grotesque Variable`.
- Body, navigation, forms, tables, metadata, and controls: `IBM Plex Sans Variable`.
- Numeric and technical values use IBM Plex Sans with tabular figures.
- Maximum typeface count: two.

### 7.2 Hierarchy

- Display headings: weight 720, tracking `-0.035em`, line height `0.98–1.08`.
- Section headings: weight 650–700, compact but not all-caps by default.
- Body: weight 400–450, line height `1.5–1.65`.
- Labels: weight 600, maximum tracking `0.04em`.
- Microcopy never drops below 12 px and must remain high enough contrast to read.

Use solid `ink` for headings. Italic display text, gradient text, and repetitive ornamental eyebrows are outside the system.

## 8. Layout system

### 8.1 Desktop workbench

At 1024 px and wider, major preparation routes follow a repeatable sequence:

1. **Functional heading** — route/project identity, status, next action.
2. **Workspace map** — route context and current position in the Project preparation journey.
3. **Primary work zone** — the form, evidence, record, decision, or configuration being worked on.
4. **Context zone** — history, guidance, metadata, related actions, or validation.
5. **Resolution state** — saved, ready, blocked, or next route.

This is a hierarchy, not a mandatory card template. Pages should not accumulate interchangeable floating panels.

### 8.2 Grid and density

- Use the 4 px seed and the named spacing scale from `design.md`.
- Prefer alignment and rule-based grouping over container proliferation.
- Allow asymmetry when it makes the active task dominant.
- Constrain long reading lines while allowing tables, maps, and work surfaces to use the width they need.
- Dense operational areas may reduce vertical spacing, but control targets and readable line height remain intact.

### 8.3 Compact safety

The primary product target is desktop, but the shell and authentication experience must work at 320–768 px:

- no horizontal document scroll;
- no clipped theme, sign-in, account, or navigation actions;
- no dialog wider than the viewport minus safe gutters;
- controls wrap or stack in logical reading order;
- essential actions remain reachable with touch and keyboard;
- layouts are checked at 320, 375, 414, and 768 px.

Feature workbenches may become single-column in this range. They must communicate if a specialized desktop-only work surface has a genuine minimum supported width rather than failing silently.

## 9. Navigation: N11 control panel

### 9.1 Desktop

- Keep the closed application bar stable between routes.
- Use existing product areas to group destinations, up to four columns.
- Keep the open panel at or below 60 vh and provide internal scrolling only when unavoidable.
- The panel is opaque `paper-2`/`paper-3` with structural rules. No translucency or backdrop blur.
- A low-opacity neutral scrim may dim the workbench; it must not blur it.
- Open with click and keyboard. Hover is optional enhancement and requires a close grace period.
- Only one navigation group opens at a time.
- `Escape` closes the panel and restores focus to its trigger.
- Triggers expose `aria-expanded` and `aria-controls`; focus moves predictably through grouped links.

### 9.2 Compact

At 768 px and below, use a drawer with accordion groups:

- preserve destination order and naming;
- expose a clearly labeled close action;
- contain focus while modal and restore it on close;
- avoid nested horizontal scrolling;
- do not shrink the desktop mega-menu into an unusable miniature.

## 10. Components

### 10.1 Buttons

- Primary: blue `accent` fill with `accent-ink`; one visually primary action per action group.
- Secondary: paper surface, rule border, `ink` text.
- Tertiary: text/icon with a structural hover/focus cue.
- Destructive: `danger` only for an actual destructive action.
- Radius: `radius-control`, not pill, except a true segmented/binary control.
- Press feedback may use a short translate/scale transform within the motion contract.

### 10.2 Inputs and forms

- Labels remain visible; placeholders do not replace labels.
- Inputs use paper hierarchy and structural border, with yellow focus ring.
- Error, warning, and success states combine color with text/icon.
- Helper and validation text remain adjacent to the control they explain.
- Form actions keep a predictable order across themes and breakpoints.

### 10.3 Cards and panels

- Use a panel only when it establishes a meaningful region or state.
- Default treatment is opaque surface plus rule; no glass or glow.
- Radius is 4 px.
- Avoid card-inside-card stacking. Use dividers, columns, or typographic hierarchy instead.

### 10.4 Status and journey markers

- Pills are allowed for concise status/count only.
- Discovery markers use magenta plus label/icon/shape.
- Decision markers use yellow plus label/icon/shape.
- Current route uses blue plus a position or weight change.
- Completed/blocked states use their semantic roles and explicit text.

### 10.5 Overlays

- Menus, dialogs, and popovers are opaque.
- One restrained neutral overlay shadow may separate them from the workbench.
- Backdrop blur, tinted glow, and stacked translucent layers are prohibited.

## 11. Theme implementation contract

- Default root class: `pm-dark`.
- Alternate root class: `pm-light`.
- Exactly one is present on the document root.
- Explicit user choice is persistent and applied before first meaningful paint where platform constraints allow.
- Native controls use the matching `color-scheme`.
- Components consume semantic tokens; they do not branch on theme in feature code unless a third-party API requires it.
- Both themes must support all interaction, validation, disabled, overlay, and focus states.
- System preference may inform a future opt-in “system” option, but it must not silently override a stored explicit choice.

## 12. Motion implementation contract

Only three motion families are authorized:

| Family | Purpose | Maximum normal duration |
| --- | --- | --- |
| Workspace map reveal | Explain the route/current position once | 320 ms |
| Route transition | Maintain continuity between routes | 320 ms |
| Direct control feedback | Press, expand, collapse, validate, select, focus | 220 ms |

- Animate `transform` and `opacity` only.
- No infinite or autonomous motion.
- Do not animate background position, box shadow, filter, blur, layout dimensions, or decorative particles.
- Reduced-motion mode removes spatial travel and caps opacity feedback at 150 ms.
- Route motion must never delay navigation or input readiness.

## 13. Accessibility

- Target WCAG AA for normal text and interactive components.
- Use the yellow `focus` role for a visible focus indicator; keep a non-color boundary/offset where practical.
- Touch targets are at least 44 × 44 px in compact layouts.
- Maintain logical DOM and focus order when workbench columns rearrange.
- Menus, drawers, dialogs, and disclosures expose correct names, states, relationships, and focus behavior.
- Do not remove focus outlines without an equal or stronger replacement.
- Announce validation and asynchronous state changes appropriately.
- Check dark and light themes independently; passing one is not evidence for the other.

## 14. Prohibited patterns

- Ambient infinite animation or decorative looping motion.
- Aurora backgrounds, blooms, halos, scan lines, particles, or glow.
- Glassmorphism, backdrop blur, or translucent cards/menus.
- Gradient-filled headings or wordmarks.
- Repetitive uppercase eyebrow ornament.
- Fake browser/device frames around product UI.
- Excessive rounded cards and pill-shaped primary controls.
- Raw color literals in feature styles.
- Page-local fonts, themes, logo variants, or semantic color remapping.
- Visual renaming of established Project Maker domain concepts.

## 15. Proportional verification

Validate only the directly affected behavior and highest-risk regressions:

1. Build and type-check the Angular web application.
2. Exercise theme selection, persistence, reload behavior, and initial-paint behavior in both themes.
3. Keyboard-test N11 open/close, `Escape`, focus restoration, and compact drawer behavior.
4. Check shell and authentication at 320, 375, 414, 768, 1024, and a representative wide desktop viewport.
5. Check contrast and visible focus for primary, secondary, disabled, discovery, decision, warning, danger, and overlay states in dark and light.
6. Verify reduced motion for the workspace map, route transitions, and control feedback.
7. Use focused visual regression coverage for the shell, authentication, one representative workbench, and the logo/favicon—not every route indiscriminately.

## 16. Change control

Durable changes require all of the following:

1. update `design.md` first;
2. update this master specification if implementation guidance changes;
3. keep every inline export synchronized;
4. prepend a newest-first record to `.hallmark/log.json`;
5. explain any accessibility, product, or platform reason for departing from a locked choice.
