# Project Maker web-platform requirements

This is the current delivery baseline. Checked items are verified in the
Angular/NestJS monorepo; unchecked items remain future delivery work.

## Foundation

- [x] **FOUND-01:** pnpm monorepo contains Angular web, NestJS API, and shared contracts packages.
- [x] **FOUND-02:** API exposes `GET /health` with `{ "status": "ok" }`.
- [x] **FOUND-03:** Web shell renders Project Maker and configures PrimeNG.
- [x] **FOUND-04:** Compose defines web, internal API, and internal PostgreSQL with health checks and named persistence.
- [x] **FOUND-05:** API startup requires one exact HTTP(S) `CORS_ORIGIN` and rejects malformed or unsafe values.
- [x] **FOUND-06:** Compose image build and host HTTP smoke pass with Docker Desktop Linux engine available.

## Product domain and intake

- [x] **DOMAIN-01:** Product workflow, domain terms, the version-1 playbook, and scoring contract are defined in `docs/product-domain.md` and `packages/contracts`.
- [ ] **INTAKE-01:** Users can create, list, edit, archive, reopen, and explicitly delete projects.
- [ ] **INTAKE-02:** Users can run the versioned guided interview/checklist and record answers.
- [ ] **INTAKE-03:** Answers autosave and remain recoverable after restart.
- [ ] **INTAKE-04:** Users can manage follow-ups with owner, due date, status, answer/decision, and next step.
- [ ] **INTAKE-05:** The UI provides Hungarian coaching content and deterministic answer-quality guidance.

## Scoring and output

- [ ] **SCORE-01:** Completion, readiness, gaps, Decision Score, and recommended action implement the domain contract and have behavioral tests.
- [ ] **OUTPUT-01:** Structured Markdown is the canonical generated specification.
- [ ] **OUTPUT-02:** Acceptance criteria and user stories derive from the canonical specification.
- [ ] **OUTPUT-03:** PDF and spreadsheet exports derive from the canonical specification and handle Hungarian text and dynamic content.

## Data and platform evolution

- [ ] **DATA-01:** PostgreSQL schema preserves stable IDs, timestamps, archived state, selected playbook version, answers, follow-ups, and derived-state provenance.
- [ ] **DATA-02:** Schema migrations are explicit, versioned, and reversible where practical.
- [ ] **DATA-03:** Backup and restore are implemented and verified on the current platform.
- [ ] **MIG-01:** Supported project exports can be imported non-destructively and idempotently.
- [ ] **PWA-01:** The Angular application is installable and its offline/update behavior is verified.
- [ ] **SEC-01:** Authentication and authorization are defined before multi-user data access is enabled.
- [ ] **AI-01:** Any live LLM integration is optional, explicitly consented, and isolated behind a replaceable boundary.
