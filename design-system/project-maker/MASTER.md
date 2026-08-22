# Project Maker Design System

> Product-wide source of truth. Page-specific files under `pages/` may only
> refine these rules; they must not introduce a parallel palette, spacing scale,
> or interaction language.

**Direction:** dark operational workspace with aurora atmosphere and restrained
HUD details
**Design dials:** variance 8/10 · motion 8/10 · density 7/10
**Product constraints:** professional PM/PO software, data remains primary,
workflow behavior and domain meaning do not change

## Brand idea

Project Maker turns uncertain discovery into an executable delivery path. The
mark combines three connected project nodes with a forward path inside an
angular `P`: blue is structure, magenta is discovery, and yellow is the decision
signal. The visual language repeats that idea through clipped corners,
connection lines, signal nodes, and layered panels.

## Color system

Brand color is expressive; state color is informational. Never use magenta or
yellow alone to mean success, error, or completion.

| Role | Token | Reference value |
| --- | --- | --- |
| Canvas | `--pm-canvas` | `oklch(0.105 0.025 275)` |
| Deep canvas | `--pm-canvas-deep` | `oklch(0.075 0.022 275)` |
| Surface | `--pm-surface-1` | `oklch(0.155 0.035 270)` |
| Raised surface | `--pm-surface-2` | `oklch(0.195 0.042 270)` |
| Interactive surface | `--pm-surface-3` | `oklch(0.235 0.052 270)` |
| Primary text | `--pm-text` | `oklch(0.955 0.015 265)` |
| Muted text | `--pm-text-muted` | `oklch(0.72 0.045 265)` |
| Electric blue | `--pm-blue` | `oklch(0.72 0.19 243)` |
| Cyan highlight | `--pm-cyan` | `oklch(0.86 0.145 204)` |
| Signal magenta | `--pm-magenta` | `oklch(0.72 0.25 323)` |
| Decision yellow | `--pm-yellow` | `oklch(0.89 0.18 98)` |
| Success | `--pm-success` | `oklch(0.76 0.17 155)` |
| Warning | `--pm-warning` | `oklch(0.82 0.16 80)` |
| Danger | `--pm-danger` | `oklch(0.68 0.22 25)` |

Text contrast is at least 4.5:1. Status is always expressed with a label or icon
in addition to color. Neon glow is reserved for active navigation, primary
focus, and one or two focal elements per view.

## Typography

- UI: `Inter`, `Segoe UI Variable`, `system-ui`, sans-serif.
- Display: `Bahnschrift`, `Segoe UI Variable Display`, UI fallback.
- Technical values, repository paths, template source, and versions:
  `ui-monospace`, `Cascadia Code`, `Consolas`, monospace.
- Page title: `clamp(2rem, 4.5vw, 3.5rem)`, tight leading and tracking.
- Section title: 1.125–1.375rem, semibold.
- UI body: 0.925–1rem; never below 1rem for mobile body content.
- Metadata: 0.75–0.8125rem, uppercase only for short labels.
- Numbers used for comparison use tabular figures.

## Spacing and shape

Use a 4px base rhythm: 4, 8, 12, 16, 24, 32, 48, 64. Page gutters are
24px on compact laptop windows and 32px on desktop. Standard controls are at
least 44px high. Cards use 14–18px radii with one clipped accent corner; small
controls use 8–10px radii. Avoid pill shapes except for statuses, counts, and
compact metadata.

## Surfaces and depth

1. Canvas: dark static background plus low-opacity grid.
2. Ambient layer: two blurred blue/magenta aurora fields and sparse yellow
   signal nodes; never captures pointer input.
3. Surface: translucent dark panel, one hairline border, subtle top highlight.
4. Interactive surface: blue border/glow and a maximum 2px lift on hover.
5. Overlay: opaque enough for text clarity, strong shadow and backdrop scrim.

Use spacing or value contrast before adding another border. Editor, Markdown,
Git, and diagnostic content use a dedicated inset code surface.

## Layout primitives

- `pm-page-header`: title and primary actions; actions wrap before text clips.
- `pm-surface`: standard glass panel.
- `pm-surface--interactive`: clickable record/card treatment.
- `pm-action-group`: wrap-safe button group with consistent target sizes.
- `pm-form-grid`: responsive auto-fit form grid with `minmax(0, …)`.
- `pm-code-surface`: inset monospace editor/preview surface.
- `state-panel`: shared loading, empty, and error presentation.

Every flex/grid content child that may contain user data gets `min-width: 0`.
Long names and identifiers wrap; truncation is allowed only when a visible full
value path exists. Tables scroll or turn into record cards on narrow screens.

## Navigation

- Wide desktop: one compact global navigation row in the branded shell.
- Laptop and compact desktop windows: an explicit `Navigation` trigger opens a structured panel;
  never allow ten labels to wrap unpredictably.
- Project context navigation remains a separate level with visible current
  location and horizontal overflow containment.
- Active destinations use a blue accent line, bright text, and restrained glow.
- Account identity is truncated visually but retains its full accessible value.

## Motion

Motion communicates navigation, selection, save state, or hierarchy.

- Button/field feedback: 120–180ms.
- Card/nav transitions: 180–240ms.
- Route transition: 220–320ms opacity + 8–12px transform using Angular View
  Transitions, with progressive fallback.
- Ambient aurora: 14–22s loop; scan line: 10–16s loop.
- Animate only transform, opacity, filter, and background position.
- `prefers-reduced-motion: reduce` disables all ambient and route motion and
  preserves the final static state.

## Component rules

- Primary buttons are electric blue with deep-canvas text; destructive buttons
  remain red. Magenta is an emphasis/selection accent, not the default CTA.
- Native and PrimeNG fields share the same height, surface, border, focus ring,
  invalid state, and disabled state.
- Record cards expose the title, current status, next action, and only the most
  relevant actions. Secondary actions may wrap or move into existing disclosure.
- Empty states explain why the view is empty and provide the next useful action.
- File rows reserve a flexible filename column and a wrapping action group.
- Code/template previews never clip; they scroll inside their own bounded
  surface.

## Accessibility and performance guardrails

- Keyboard focus is always visible and never hidden under sticky UI.
- Pointer targets are at least 24×24 CSS px; primary controls target 44px for comfortable desktop use.
- No hover-only primary action, no emoji structural icon, no color-only status.
- Decorative SVG and ambient motifs are hidden from assistive technology.
- No runtime animation library is required; use CSS and Angular native routing.
- Do not duplicate the global visual system in component styles.

## Delivery checklist

- [ ] Dark theme and PrimeNG components use the same semantic tokens.
- [ ] Logo is consistent in shell, authentication, public response, and favicon.
- [ ] No horizontal page overflow at 1024, 1280, 1440, and 1920px.
- [ ] Long project names, email addresses, filenames, remotes, and template text
      remain accessible.
- [ ] Navigation trigger, focus order, Escape close, and active location work.
- [ ] Motion is responsive and reduced-motion produces a stable static UI.
- [ ] Text and non-text contrast meet WCAG AA.
- [ ] Existing Project Maker workflow behavior remains unchanged.
