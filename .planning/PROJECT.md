# Project Maker web platform

## Purpose

Project Maker turns a customer discovery conversation into a concrete,
development-ready requirement package while coaching PM, PO, and BA users
toward stronger discovery practice.

The platform is an intake and requirements-clarification product, not a
general project-management system. The authoritative workflow, vocabulary,
playbook, and scoring rules are defined in `docs/product-domain.md` and the
shared contracts package.

## Current platform

- Browser-based Angular client with PrimeNG.
- NestJS API.
- PostgreSQL persistence through TypeORM migrations.
- Nginx and Docker Compose deployment topology.
- Shared TypeScript contracts between platform components.
- Hungarian end-user experience; English engineering and operational documentation.
- AI is optional enrichment; deterministic workflows remain useful without it.

## Current constraints

- Only verified platform behavior may be marked delivered.
- Preserve stable domain meaning and plan explicit data migrations before
  changing persisted contracts.
- Keep CORS configuration to one exact HTTP(S) origin.
- Keep API and PostgreSQL internal in Compose; only the web gateway publishes a
  host port.
- Do not require live AI for core product operation.
- Keep authentication and authorization outside the foundation until they are
  separately designed and verified.
