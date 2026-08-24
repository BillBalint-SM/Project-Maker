# Project Maker — Master Design System

Status: active

Supersedes: the previous Workbench/N11 production direction

Canonical visual tokens: [`tokens.css`](../../tokens.css)
Full rationale and export formats: [`design.md`](../../design.md)

## 1. Product character

Project Maker is a preparation journey with an operational power layer.

- **Journey** is the core Portfolio view: spatial, orienting, selective.
- **Queue** is the power-user view: dense, fast, scan-first.
- Both views expose the same underlying work and use one visual system.
- Dark is the default; light is a complete user-selectable counterpart.

The target feeling is cinematic but controlled: deep midnight surfaces, sharp route geometry, clear cyan movement, magenta discovery, and yellow decision signals.

## 2. Locked selections

| Dimension | Production rule |
|---|---|
| Hallmark genre | Atmospheric |
| Core macrostructure | Map / Diagram |
| Queue macrostructure | Operational table with Bento information logic |
| Navigation | N4 visible Navigate trigger + Control/Command K |
| Theme | Midnight dark/light |
| Display | Tomorrow |
| Body | IBM Plex Sans Variable |
| Identity | Journey Mark |
| Footer | None |
| Enrichment | None |

## 3. Domain guardrails

### Journey

Use only `ProjectWorkState.preparationStatus.state` to place a project. The legal sequence is:

1. `SCHEMA_REQUIRED`
2. `INTAKE_IN_PROGRESS`
3. `CLARIFICATION_REQUIRED`
4. `DECISION_REVIEW_REQUIRED`
5. `ESTIMATE_PREPARABLE`
6. `ESTIMATE_READY`

Do not use project administration status, health, readiness percentage, decision score, or a fabricated progress calculation as a spatial substitute.

### Queue

Use the existing active-queue contract and preserve:

- server-defined urgency order and `groupCounts`;
- URL-backed search and filters;
- opaque cursor navigation;
- explicit refresh, retry, stale-data, and cursor-recovery states;
- canonical `nextAction`, owner, due date, factual progress, and `primaryAction`.

## 4. Identity

The Journey Mark is a rising route with three colored nodes and a forward corner.

- Magenta: discovery input.
- Cyan: active route.
- Yellow: decision/readiness.
- Dark under-stroke: contrast in both themes.

Use the full “Project Maker” wordmark in the application shell. The mark may stand alone only where the product name is already present, such as the favicon.

## 5. Color architecture

Consume semantic roles only:

- `--color-paper`, `--color-paper-deep`, `--color-paper-2`, `--color-paper-3`
- `--color-ink`, `--color-ink-2`, `--color-muted`
- `--color-rule`, `--color-rule-2`, `--color-control-border`
- `--color-accent`, `--color-accent-ink`
- `--color-discovery`, `--color-decision`, `--color-focus`
- `--color-success`, `--color-warning`, `--color-danger`

Legacy `--pm-*` variables are compatibility aliases to these roles, not a second palette.

Rules:

- Accent is structural and interactive, not decorative fill.
- Discovery and decision colors keep their domain meaning.
- Queue never switches to Terminal green.
- State always has a text, count, or geometric cue in addition to color.
- Pure black, pure white, and zero-chroma surfaces are prohibited.

## 6. Typography

- Use Tomorrow at 500–700 for the wordmark and high-level headings.
- Use IBM Plex Sans Variable for body, controls, labels, and technical values.
- Use tabular figures for counts and aligned operational data.
- Keep body copy at 45–75 characters where it reads as prose.
- Display headings are roman and use line-height 1.04 or greater.
- Do not add a third face for badges, labels, or Queue data.

## 7. Layout

### Application shell

- The sticky shell keeps brand, theme selection, and Navigate trigger visible.
- The Navigate panel groups Orient, Move, and Configure.
- The surface is opaque and may scroll inside the viewport when necessary.
- Escape closes the panel and restores trigger focus.
- Control/Command K opens it and focuses the first destination.

### Journey core

- Page heading and view switch establish hierarchy before the field.
- The field declares its page/filter scope.
- Six stages read in DOM order and reflow without reordering.
- A node selection updates a factual detail strip.
- The project register remains secondary and follows the field.

### Queue power view

- Real summary counts form a compact metric rail.
- Search, urgency, and preparation filters form one control strip.
- Wide layouts use a semantic table.
- Compact layouts convert rows to labelled value groups before horizontal overflow occurs.

## 8. Components and states

### Buttons and links

- Minimum control height: 44 CSS px.
- Primary fill uses `--color-accent` with `--color-accent-ink`.
- Focus uses a two-pixel `--color-focus` outline with offset.
- Hover changes one visual property family; active feedback does not shift surrounding layout.
- Disabled state uses semantic disablement, reduced emphasis, and a not-allowed cursor.

### Inputs

- Height matches adjacent controls.
- Border remains one pixel in every state.
- Focus uses outline, never a thicker border.
- Error state uses danger plus a written message.
- Helper/error slots reserve their line where the shared field pattern applies.

### Panels

- Use a tinted rule before adding elevation.
- Card radius is 12 px; control radius is 8 px.
- Avoid nested cards.
- Overlays use the shared raised shadow and an opaque readable surface.

### Status

- Urgency, preparation state, health, and formal decision remain distinct concepts.
- Do not merge labels or colors across those concepts for visual convenience.

## 9. Motion

Authorized families:

1. One Journey canvas arrival.
2. Background/border selection feedback.
3. Existing short route transition.

All motion uses transform/opacity or paint-only properties, remains interruptible, and has a reduced-motion fallback. No looping ambient motion, parallax, mesh animation, or layout-property animation.

## 10. Theme contract

- The document root owns `pm-dark` or `pm-light`.
- First visit defaults to `pm-dark`.
- User choice persists through `AppThemeState`.
- PrimeNG tokens in `app.theme.ts` map to the same palette.
- Feature styles use roles and never detect the theme to pick raw colors.
- Dark and light interaction states are verified independently.

## 11. Accessibility and responsive contract

- Preserve the skip link and semantic main landmark.
- Maintain logical heading and keyboard order.
- Every icon-only control has an accessible name and state.
- Decorative SVG is hidden; meaningful SVG has a title/description.
- Normal text reaches 4.5:1; large text, controls, and focus indicators reach 3:1.
- No page-level horizontal scroll at 320–1920 px.
- Validate 320, 375, 414, 768, 1280×800, and 1440 widths.
- Clickable navigation and CTA labels remain on one line.
- Reduced motion removes every authored transform or animation.

## 12. Prohibited patterns

- Cyan-to-magenta gradients and gradient text.
- Decorative glow, glass, blur, aurora, or particles.
- Fake browser, terminal, device, or IDE chrome.
- Emoji used as interface icons.
- Fabricated counts, percentages, or performance claims.
- A second visual language for Queue.
- Generic equal-card marketing grids.
- Color-only state encoding.

## 13. Verification

For a change to Journey, Queue, shell, theme, or tokens:

1. Run the focused adjacent Vitest specs.
2. Run web typecheck.
3. Run the web production build.
4. Exercise dark and light.
5. Exercise keyboard navigation, Control/Command K, Escape, and focus restoration.
6. Inspect 320, 375, 414, 768, 1280×800, and 1440 widths.
7. Verify reduced motion.
8. Run GitNexus `detect_changes` against the current remote main before commit.
9. Run the Hallmark 58-gate slop test before handoff.

## 14. Change control

A future redesign may change these locked choices only when the product direction changes deliberately. When that happens, update `design.md`, this file, `tokens.css`, the PrimeNG bridge, and the Hallmark log together.
