---
status: accepted
---

# Keep the project cockpit as a domain-aligned orchestration shell

The project cockpit route remains a thin orchestration module, while each business area owns its state, rules, markup, styles, and data adapter inside a cohesive deep module. The first extraction introduces a cockpit-local, typed, single-flight operation policy and then moves Discovery follow-ups behind its own seam; Customer email follow-up remains a separate domain. The server stays authoritative for lifecycle and business validity, while the browser policy coordinates concurrent mutations and presents immediate affordances.

## Considered options

- Splitting visual cards while leaving state and rules in the route would create shallow modules and preserve the current wide interface.
- A global operation manager would mix unrelated domains before a second proven use case exists.
- Moving Cockpit SCSS into global styles or raising the Angular style budget would hide the warning without improving depth or locality.

## Consequences

- Discovery follow-up loading and failures become local and cannot block the rest of the cockpit.
- All cockpit mutations remain globally single-flight; audit reads remain independent.
- The existing `4 kB` `anyComponentStyle` warning threshold stays unchanged, and the warning must disappear through domain-local style ownership rather than budget gaming.
