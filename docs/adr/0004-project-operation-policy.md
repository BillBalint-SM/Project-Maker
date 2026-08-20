---
status: accepted
---

# Keep project operations within the Selected project context

The Selected project context is the visible context for work in one project.
Each project operation belongs to the smallest domain module that owns its
state, rules, markup, styles, and data adapter. The server remains authoritative
for lifecycle and business validity. The browser coordinates conflicting
mutations with a project-scoped, single-flight operation policy while allowing
independent reads to recover locally.

## Consequences

- Project navigation is explicit and URL-backed; no hidden global current
  project is introduced.
- A domain module's loading or failure state does not block unrelated project
  work.
- The operation policy coordinates project mutations without becoming a global
  cross-domain manager.
- Raw diagnostic activity remains outside normal employee work contexts.
