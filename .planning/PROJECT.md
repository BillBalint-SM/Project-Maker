# Project Maker web platform

## Purpose

Project Maker turns a customer discovery conversation into a concrete, development-ready requirement package while coaching PM, PO, and BA users toward stronger discovery practice.

The platform is an intake and requirements-clarification product, not a general project-management system. The authoritative workflow, vocabulary, legacy-compatible domain intent, general question playbook, and scoring rules are in `docs/product-domain.md`.

## Current platform direction

- Browser-based Angular client.
- NestJS API.
- PostgreSQL persistence target.
- Nginx and Docker Compose deployment topology.
- Shared TypeScript contracts between platform components.
- Hungarian end-user experience; English engineering and operational documentation.
- AI is optional enrichment. Deterministic workflows must remain useful without it.

## Superseded implementation context

The earlier React/Vite/RxDB/IndexedDB and Tauri/Rust desktop code validated useful product behavior, but that implementation and its stack are retired from the current source tree. Historical plans under `.planning/phases/`, `.planning/research/`, and `.planning/codebase/` may explain prior decisions; they are not current architecture instructions and must not be treated as completed web-platform capabilities.

## Current constraints

- Only verified web-platform behavior may be marked delivered.
- Preserve stable domain meaning and plan explicit data migrations before changing persisted contracts.
- Keep CORS configuration to one exact HTTP(S) origin.
- Keep API and PostgreSQL internal in Compose; only the web gateway publishes a host port.
- Do not require live AI for core product operation.
- Do not claim desktop-era persistence, backup, migration, scoring, or export code as current until it is reimplemented and verified on this platform.
