# Walking Skeleton — Project-Maker (web/PWA re-platform)

**Phase:** 1
**Generated:** 2026-07-09

## Capability Proven End-to-End

A böngészőben induló webalkalmazás egy `/` route-on megjeleníti a valós IndexedDB-ből (RxDB) beolvasott projekt-listát, és egy "Új teszt-projekt" gombbal ténylegesen tud is oda új, Zod-validált rekordot írni — bizonyítva, hogy build → domain-modell/Zod → RxDB-perzisztencia → routing → UI → `pnpm dev` teljes lánca működik, mielőtt a valódi felmérési UI (Phase 2) ráépülne.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend keret | React 18.3.1 (megtartva, NEM frissítve 19-re Phase 1-ben) | A Phase 1 követelményei (DATA-01..06, PREP-01/02, MIG-01) nem igényelnek React 19-et; a 19-es váltás oka (Mantine 9 kompatibilitás) csak Phase 2-ben jelentkezik, amikor a Mantine UI-készlet ténylegesen bekerül. A meglévő Vite 8 + TS 5.5 + Vitest 4 build-lánc változatlanul megtartható. |
| Adat-réteg / perzisztencia | RxDB 17 (`getRxStorageDexie()` a böngészőben, `getRxStorageMemory()` teszteknél) + rxjs 7 | `.planning/research/STACK.md` HIGH-konfidenciás, preskriptív választása: séma-verziózás + migráció + backup + reaktív lekérdezés egy könyvtárban, backend-agnosztikus jövőbeli sync-hez. |
| Validáció | Zod 4, minden storage-boundary read/write-on | DATA-05; kiváltja a jelenlegi `as Project` cast anti-mintát (`CONCERNS.md` MEDIUM). |
| Routing | React Router 7 (`createBrowserRouter` + `RouterProvider` a data-router API-ból) | A jelenlegi MVP-nek nincs routingja (`useState<AppView>`); a webes/PWA irány és a Walking Skeleton explicit "legalább egy valós route" elvárása miatt szükséges. Kompatibilis React 18.3-mal (a `/remix-run/react-router` csomag React 18→19 hidat ad). |
| Architektúra-minta | Rétegzett mag + hexagonális portok (`domain/`, `adapters/`, `app/`, `features/`) | `.planning/research/ARCHITECTURE.md` — a domain mag pure TS, csak portokat (interfészeket) ismer; minden IO az adapterekben. |
| Legacy actor-azonosító | Hardcoded `"local-user"` stub minden envelope `updatedBy` mezőjében | CONTEXT.md D-06 — sync-előkészítés valódi auth nélkül. |
| Deployment / dev-run | `pnpm dev` (Vite dev-szerver, `http://127.0.0.1:5173`) — nincs még valódi deploy-cél | A Phase 1 hatóköre a lokális adat-alap; a tényleges hosztolt dev-környezet (PWA/hosting) Phase 5 tárgya. A dokumentált helyi teljes-stack futtatási parancs (`pnpm dev`) a walking skeleton "deployment" követelményének helyettesítője, per `planner-mvp-mode.md` ("...vagy egy dokumentált helyi teljes-stack futtatási parancs"). |
| Könyvtár-elrendezés | `src/domain/{model,ports}/`, `src/adapters/{storage,llm,sync,migration}/`, `src/app/container.ts`, `src/features/projects/` | `.planning/research/ARCHITECTURE.md` "Recommended Project Structure" — a régi `src/lib`, `src/data`, `src/features/projects/ProjectTable.tsx` stb. egyelőre VÁLTOZATLANUL megmarad referenciának/analógnak (nem törlődik Phase 1-ben), de a `main.tsx` mostantól az ÚJ router+`ProjectListView`-t mountolja, nem a régi `App`-ot. |

## Stack Touched in Phase 1

- [x] Project scaffold — a meglévő Vite+React+TS repo BŐVÍTVE új függőségekkel (`rxdb`, `rxjs`, `zod`, `react-router`) és új `src/domain/`, `src/adapters/`, `src/app/` könyvtárakkal (nem zöldmezős scaffold, mert a repo már létező Tauri-MVP-t tartalmaz — a re-platform in-place történik)
- [x] Routing — egy valós route (`/` → `ProjectListView`) React Router 7 data-router API-val
- [x] Adatbázis — valós IndexedDB olvasás ÉS írás (RxDB `StorageAdapter.list()`/`.get()`/`.put()`, Zod-validálva)
- [x] UI — egy interaktív elem: "Új teszt-projekt" gomb, ami valós írást vált ki és a listát frissíti
- [x] Deployment — dokumentált helyi teljes-stack futtatási parancs: `pnpm dev` (lásd `.planning/phases/.../01-01-PLAN.md` Task 4 acceptance criteria)

## Out of Scope (Deferred to Later Slices)

- A valódi felmérési/interjú UI (checklist, coaching-panel, playbook-navigáció) — Phase 2
- Mantine UI-készlet, React 19 frissítés, React Hook Form, Zustand — Phase 2, amikor a valódi form-heavy UI épül
- PDF/Excel export, Markdown spec-generálás — Phase 3-4
- PWA-shell, offline precache, CSP, i18n-keret — Phase 5
- Élő LLM-adapter, tényleges cloud-sync transport, auth/bejelentkezés — v2 (a mérföldkövön kívül; ebben a fázisban csak Noop-portok + envelope-előkészítés készül)
- Élő migrációs UX / export gomb a régi Tauri appban — csak formátum+import-logika készül szintetikus fixtúrán (CONTEXT.md D-01/D-02)
- A `src/lib/`, `src/data/`, `src/App.tsx` és a régi `features/` fa fizikai törlése — analógként megmarad, amíg Phase 2 ténylegesen le nem váltja

## Subsequent Slice Plan

- Phase 2: Egységes guided felmérési+checklist UI kérdésenkénti coaching-panellel, playbook-választással, readiness-pontszámmal (Mantine, React Hook Form, Zustand bevezetése)
- Phase 3: Determinisztikus minőség-heurisztika (inline tippek, nyitott kérdések) + kanonikus Markdown spec-generálás
- Phase 4: AC/user story generálás + dinamikus tördelésű PDF/Excel export a Markdown specből
- Phase 5: Telepíthető PWA-héj, offline app-shell, szigorú CSP, teljes magyar i18n-keret
