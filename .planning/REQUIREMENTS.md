# Project Maker web-platform requirements

This requirement baseline supersedes the July 2026 React/RxDB execution checklist. Checked items below mean verified in the current Angular/NestJS monorepo; product behavior previously proven only by the retired desktop/PWA implementation is marked for reimplementation.

## Foundation

- [x] **FOUND-01:** pnpm monorepo contains Angular web, NestJS API, and shared contracts packages.
- [x] **FOUND-02:** API exposes `GET /health` with `{ "status": "ok" }`.
- [x] **FOUND-03:** Web shell renders Project Maker and configures PrimeNG.
- [x] **FOUND-04:** Static Compose topology defines web, internal API, and internal PostgreSQL with health checks and named persistence.
- [x] **FOUND-05:** API startup requires one exact HTTP(S) `CORS_ORIGIN` and rejects wildcard, path, credentials, multiple origins, and malformed values.
- [ ] **FOUND-06:** Daemon-backed Compose image build and host HTTP smoke pass in an environment with Docker Desktop Linux engine available.

## Product domain and intake

- [x] **DOMAIN-01:** Platform-neutral product workflow, domain terms, legacy type intent, version-1 general playbook, and scoring contract are preserved in `docs/product-domain.md`.
- [ ] **INTAKE-01:** Users can create, list, edit, archive, reopen, and explicitly delete projects.
- [ ] **INTAKE-02:** Users can run the versioned general guided interview/checklist and record answers.
- [ ] **INTAKE-03:** Answers autosave and remain recoverable after restart.
- [ ] **INTAKE-04:** Users can manage follow-ups with owner, due date, status, answer/decision, and next step.
- [ ] **INTAKE-05:** The UI provides Hungarian coaching content and deterministic answer-quality guidance.

## Scoring and output

- [ ] **SCORE-01:** Completion, readiness, gaps, Decision Score, and recommended action implement the preserved domain contract and are covered by behavioral tests.
- [ ] **OUTPUT-01:** Structured Markdown is the canonical generated specification.
- [ ] **OUTPUT-02:** Acceptance criteria and user stories derive from the canonical specification.
- [ ] **OUTPUT-03:** PDF and spreadsheet exports derive from the canonical specification and handle Hungarian text and dynamic content.

## Data and platform evolution

- [ ] **DATA-01:** PostgreSQL schema preserves stable IDs, timestamps, archived state, selected playbook version, answers, follow-ups, and derived-state provenance.
- [ ] **DATA-02:** Schema migrations are explicit, versioned, and reversible where practical.
- [ ] **DATA-03:** Backup and restore are implemented and verified on the current platform.
- [ ] **MIG-01:** Supported legacy exports can be imported non-destructively and idempotently.
- [ ] **PWA-01:** The Angular application is installable and its offline/update behavior is verified.
- [ ] **SEC-01:** Authentication and authorization are defined before multi-user data access is enabled.
- [ ] **AI-01:** Any live LLM integration is optional, explicitly consented, and isolated behind a replaceable boundary.

## Explicitly not current

The removed React components, RxDB adapters, IndexedDB migrations, Tauri/Rust commands, desktop SQLite storage, installer, and desktop exports are historical implementation evidence only. Their earlier tests do not satisfy the unchecked web-platform requirements above.
