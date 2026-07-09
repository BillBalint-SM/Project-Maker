# Phase 1: Adat-alap, portok, perzisztencia és MVP-migráció - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Ez a blokkoló alapozó fázis: sync-re felkészített, verziózott adatmodell (envelope: stabil kliens-generált ID, `schema_version`, `revision`, `updated_at`, `updated_by`, `deletedAt` tombstone, `dirty`), a hexagonális port-réteg (Storage/Content/Export/Llm/Sync — Noop-adapterekkel), kliensoldali perzisztencia, Zod-validáció, backup/restore, és a legacy Tauri-MVP adat import-logikája (formátum + validáció, nem élő migrációs UX). Semmi más fázis nem épülhet erre, amíg ez nincs kész.

Mivel ez egy vadonatúj projekt első fázisa MVP módban, **Walking Skeleton** is készül: a project scaffold + routing + 1 valós DB olvasás/írás + 1 interaktív UI-elem + dev deploy minimális, végponttól-végpontig működő szelete.

</domain>

<decisions>
## Implementation Decisions

### Legacy migráció (MIG-01) hatóköre
- **D-01:** A migráció ebben a fázisban CSAK a formátum/import-logika (parse + Zod-validáció + idempotens, nem-destruktív import) — nem kell élő migrációs UX, és nem kell exportot építeni a régi Tauri appba.
- **D-02:** A tesztelés valósághű, szintetikus fixtúrán történik (a régi SQLite `data` JSON-blob formátumát reprezentáló minta), nem éles felhasználói adaton — még nincs éles felhasználó.

### Walking Skeleton — minimális proof-of-life UI
- **D-03:** A Phase 1 végén látható minimális felület egy **projekt-lista nézet**, amely az IndexedDB-ből olvassa ki és jeleníti meg a (teszt-)projekteket. Ez egyszerre bizonyítja az olvasást, az írást és a routingot.
- **D-04:** Ez NEM a valódi felmérő/interjú UI (az Phase 2-ben készül) — pusztán a teljes lánc (build → adatbázis → UI → dev deploy) működésének bizonyítéka.

### Backup/restore UX (DATA-06)
- **D-05:** Valódi, látható UI-gomb kerül az appba: "Adatmentés exportálása" (JSON fájl letöltése a böngészőn keresztül) és "Visszaállítás" (fájl-feltöltés). Nem csak belső/API-szintű logika.

### Local actor-azonosító (PREP-02 előkészítés)
- **D-06:** Egy hardcoded `"local-user"` stub azonosító kerül az envelope `updated_by` mezőjébe minden rekordon. Ez előkészíti a syncet, de még nincs valódi felhasználó-fogalom vagy bejelentkezési UI.

### Claude's Discretion
- A konkrét RxDB/Dexie séma-definíció, a Zod-séma pontos alakja, a port-interfészek (TypeScript signature-ök) részletei — a kutatás (STACK.md, ARCHITECTURE.md) HIGH konfidenciával már lezárta ezeket; a planner ez alapján dolgozzon, újra nem kérdezendők.
- A projekt-lista nézet pontos vizuális megjelenése (ez ideiglenes proof-of-life, nem végleges UI — a végleges UI Phase 2/5-ben kap tervet).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Kutatás — architektúra és stack döntések
- `.planning/research/SUMMARY.md` — a négy kutatási dimenzió egybehangzó összegzése; a blokkoló Phase 1 döntéscsomag (stabil ID, envelope, schema_version, tombstone, backup) forrása
- `.planning/research/ARCHITECTURE.md` — rétegzett mag + hexagonális port-minta (5 port, Noop-adapterek), build-sorrend
- `.planning/research/STACK.md` — RxDB 17 (Dexie storage) + Zod 4 + React 19.2 + Vite 8 preskriptív választás, indoklással
- `.planning/research/PITFALLS.md` — a Phase 1-et közvetlenül érintő buktatók: stabil ID hiánya, hard delete/tombstone, séma-verziózás, LLM-kulcs/CSP (utóbbi Phase 5-höz kapcsolódik, de itt kell előkészíteni)

### Meglévő kódbázis — mit vált le és mit mintáz
- `.planning/codebase/CONCERNS.md` — a jelenlegi MVP HIGH/MEDIUM hiányosságai, amiket ez a fázis old meg (séma-verziózás hiánya, nincs backup, típus nélküli JSON-blob validáció)
- `.planning/codebase/ARCHITECTURE.md` — a jelenlegi `ProjectStorageAdapter` interfész és `ProjectRepository` minta (`src/lib/storageTypes.ts`, `src/lib/storage.ts`) — ennek hexagonális kiterjesztése történik, nem eldobása

### Projekt-szintű kontextus
- `.planning/PROJECT.md` — Core Value, Constraints (opcionális AI, rugalmas offline, web/PWA)
- `.planning/REQUIREMENTS.md` — DATA-01..06, PREP-01/02, MIG-01 pontos megfogalmazása

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProjectStorageAdapter` interfész (`src/lib/storageTypes.ts`) — a jelenlegi adapter-mintázat koncepcionálisan mintaként szolgál az új `StoragePort`-hoz (nem szó szerinti kódmigráció, mivel a stack teljesen lecserélődik Tauri/Rust/SQLite-ról web/RxDB-re)
- `recalculateProject()` mintája (`src/lib/project.ts`) — "sosem tárolt, mindig újraszámolt derived state" elv, amit a domain mag is kövessen

### Established Patterns
- Adapter-választás factory függvénnyel futásidőben (`createProjectStorageAdapter()`) — jó hexagonális előzmény, de az új kódban típusbiztos DI-vel/composition roottal (`app/container.ts`) helyettesítendő
- A jelenlegi kód a JSON blobot séma-validáció NÉLKÜL castolja (`as Project`) — ezt kell Zod-dal kiváltani (DATA-05)

### Integration Points
- Nincs literál integrációs pont a meglévő Tauri kóddal, mivel ez egy re-platforming (új kódbázis, más stack) — az egyetlen kapcsolódás a MIG-01 import-logika, ami a régi SQLite `data` JSON-blob formátumát olvassa be

</code_context>

<specifics>
## Specific Ideas

- A backup export/import gombok legyenek ténylegesen látható, kattintható UI-elemek (nem csak belső API) már ebben a fázisban.
- A Walking Skeleton "proof of life" felülete kifejezetten a projekt-lista legyen — ne form, ne debug-oldal.

</specifics>

<deferred>
## Deferred Ideas

- Élő migrációs UX / export gomb a régi Tauri appban — csak akkor releváns, ha valódi éles felhasználói adat lesz; egyelőre szintetikus fixtúrán tesztelünk.
- Valódi felhasználó-fogalom / bejelentkezés — a sync-mérföldkővel érkezik (v2, SYNC-01..03).

[Nincs más — a beszélgetés a fázis hatókörén belül maradt.]

</deferred>

---

*Phase: 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci*
*Context gathered: 2026-07-09*
