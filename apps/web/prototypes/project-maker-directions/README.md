# Project Maker — five design directions

> **Throwaway, read-only design lab.** This prototype is isolated on the local
> `codex/design-directions-prototype` worktree. It does not call the API, persist data,
> change production routes, or modify the current Project Maker implementation.

## The design question

Which product personality makes the **Project preparation journey** easiest to understand and
act on while giving Project Maker a distinctive, alive identity?

Every direction presents the same four sample Projects, preparation states, and next actions. The
data is illustrative and all interactions are non-persistent, so the comparison is about
information architecture, visual language, and interaction character—not different product data.

## Run locally

From the isolated worktree root:

```powershell
node apps/web/prototypes/project-maker-directions/serve.mjs
```

Then open any direction directly:

- [A · Decision Ledger](http://127.0.0.1:4173/?variant=ledger)
- [B · Journey Field](http://127.0.0.1:4173/?variant=journey)
- [C · Quiet Workshop](http://127.0.0.1:4173/?variant=quiet)
- [D · Ops Grid](http://127.0.0.1:4173/?variant=ops)
- [E · Project Playground](http://127.0.0.1:4173/?variant=play)

Use the fixed bottom switcher or the left and right arrow keys to move between variants. In
Journey Field, `Ctrl+K` or `Cmd+K` opens the navigation palette. The **Leírás** button explains the
active concept in Hungarian.

Google Fonts are requested over the network. If they are unavailable, the prototype uses its
declared system fallbacks; layout and interactions remain functional.

## Concepts

| Direction | Concept and direction | Motivation | Opportunity | Material trade-off |
| --- | --- | --- | --- | --- |
| **A · Decision Ledger** | Projects become an edited decision ledger: a light Newsprint surface, newspaper masthead, long-document rhythm, typographic actions, and hairline rules. | Replace dashboard fatigue with a narrative reading order that foregrounds state, evidence, and the next decision. | Strong editorial/consultancy authority; useful foundation for executive review, decision logs, and print/PDF views. | Slower for high-volume cross-project triage and less spatially expressive about journey progress. |
| **B · Journey Field** | The preparation journey becomes the navigation: Projects are selectable nodes on a dark cinematic map, supported by a command palette. | Create an immersive feeling through spatial orientation and purposeful reveal—not decorative animation. | Excellent for onboarding and explaining preparation state; a selected node can later zoom into its own Project workspace. | Responsive, keyboard, and accessible implementation is more complex; some power users will still prefer a table. |
| **C · Quiet Workshop** | One current Project and next action dominate a warm paper/deep-green Split Studio; supporting work stays in a calm secondary list. | Reduce cognitive load during long focus sessions and help the user finish the next meaningful step. | Premium, calm professional character; especially strong for interviews, forms, and deep Project work. | Weaker for portfolio-level triage and intentionally less explicit about global information architecture. |
| **D · Ops Grid** | A dense power-user instrument panel with a dark terminal palette, side rail, asymmetric bento cells, and tabular state. | Maximize scan speed and operational throughput for daily PMO use. | Natural home for shortcuts, saved views, queue handling, and live operational signals. | Steeper learning curve, potentially intimidating for occasional users, and needs a distinct mobile composition. |
| **E · Project Playground** | Next actions become friendly, physical work objects in a cream, multi-accent Hum world with slab navigation and a small brand character. | Make rigorous Project work approachable and alive without hiding real states or next actions. | Strong onboarding, adoption, and memorable brand identity—the most overtly distinctive product personality. | May feel too informal in conservative operations; semantic colors need strict governance to avoid ambiguity. |

## Prototype boundaries

- Read-only sample data; no API calls, authentication, backend mutations, application routing, or persistence.
- Static HTML, CSS, and JavaScript with a dependency-free local Node server.
- No production components or existing functions/classes/methods are modified.
- This worktree contains no commit or push as part of the design comparison.
- The five directions are deliberately structurally different and are not proposals to combine all
  visual devices into one interface.

The next product decision should be selection of one direction—or a clearly named pairing such as
**Journey Field structure + Quiet Workshop tone**—before turning the chosen prototype into a
production design system.
