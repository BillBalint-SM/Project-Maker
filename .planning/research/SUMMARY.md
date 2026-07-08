# Projekt-kutatás összefoglaló

**Projekt:** Project-Maker
**Domain:** Local-first, offline-képes, sync-re felkészített web/PWA követelmény-elicitációs (discovery/intake/interjú) eszköz PM/PO-knak — determinisztikus coaching-réteggel és opcionális LLM-augmentációval
**Researched:** 2026-07-08
**Confidence:** HIGH (adatmodell/perzisztencia, architektúra, stack-mag, pitfalls); MEDIUM (determinisztikus coaching konkrét minták, sync-backend iránya, PDF-lib végleges választás)

## Executive Summary

A Project-Maker egy PM/PO-knak szánt követelmény-elicitációs eszköz **re-platformingja**: a validált Tauri 2 + Rust/SQLite asztali MVP-t web/PWA-ra visszük. A négy kutatási dimenzió **egybehangzó** következtetése, hogy ez nem egy feature-projekt, hanem elsősorban egy **adatmodell- és architektúra-alapozó** munka: a domain szakértői local-first web-appokat egy **rétegzett mag + ports-and-adapters (hexagonális) perem** kombinációjaként építenek, ahol a lokális store a single source of truth, a hálózat (jövőbeli sync) és az LLM pedig opcionális periféria, port mögött. A meglévő MVP `ProjectRepository` + `StorageAdapter` párosa már a helyes csont — a feladat ennek kiterjesztése, nem eldobása.

A kutatás **kritikus, blokkoló első fázisként** azonosítja az adatmodell/perzisztencia alapozását. A négy dokumentum egymástól függetlenül ugyanazt a nem-halasztható döntéscsomagot írja elő: **stabil, kliens-generált ID (ULID/UUIDv7), sync-envelope, `schema_version` + migrációs lánc, tombstone (soft-delete), per-mező `updated_at`, monoton `version` counter, actor_id, backup/restore és Zod runtime-validáció**. Ezek visszamenőleg a legdrágábban javítható döntések (`CONCERNS.md` HIGH), és mind a jövőbeli max 5 fős syncet teszik fájdalommentessé — anélkül, hogy most syncet építenénk. A termék fő **differenciálója** és értékajánlat-magja a **determinisztikus, AI-mentes coaching-réteg** (kérdésenként: miért fontos / mit ad technikailag / hogyan kérdezz / etikett), amely a felhasználót „junior → senior project leader" úton emeli — ezt a piac alig fedi le.

A fő kockázatok és kezelésük: (1) **scope-robbanás** — a „sync-ready" nem „sync-implementáció", a max 5 fős skálán tilos CRDT/auth/transport most; minden fázis legyen „AI és sync nélkül is teljes"; (2) **az LLM kötelező függőséggé válása** — a determinisztikus pipeline mindig teljes kimenetet ad, az LLM csak `NoopLlmAdapter` mögül, feature-flaggel dúsít, és a CSP bekapcsolása az AI-kulcskezelés előfeltétele; (3) **kliensoldali export-robbanás és beragadt PWA-cache** — tördelést natívan támogató PDF-motor + worst-case fixtúra, Workbox precache + kontrollált frissítés-UX.

## Key Findings

### Recommended Stack

A stack teljesen nyitott (a Tauri/Rust réteget elhagyjuk); a React + TypeScript frontend-tapasztalat megőrizhető. A választásokat a `CONCERNS.md` figyelmeztetései (séma-verziózás hiánya, nincs backup, kikapcsolt CSP, típus nélküli JSON-blob, két PDF-lib, God-component, nincs CI) közvetlenül vezérlik. A kulcsdöntés a **perzisztencia**: RxDB (Dexie storage), mert a „most local-first, később saját backendre sync" út egyetlen könyvtárban, backend-agnosztikusan megoldott, és egyszerre teljesíti a séma-verziózás + backup elvárásokat.

**Core technologies:**
- **TypeScript 5.9 (`strict`) + React 19.2 + Vite 8** — a meglévő MVP-tapasztalat átvihető; strict + Zod kezeli a „típus nélküli `as Project` cast" kockázatot.
- **RxDB 17 (Dexie storage) + rxjs 7** — kliensoldali local-first perzisztencia; beépített séma-verziózás + migráció, backend-agnosztikus replikáció (sync-ready), backup plugin, reaktív lekérdezések (feloldja a God-component + kézi „refreshLists" mintát).
- **Mantine 9** — 120+ akadálymentes komponens, beépített dark mode, TS-first; nincs szükség Tailwind + fejből-épített komponensekre.
- **Zod 4 + React Hook Form 7 + Zustand 5 + React Router 7** — runtime-validáció, form-kezelés, könnyű UI-state (a domain-adatot az RxDB reaktív lekérdezései adják), PWA-routing.
- **@react-pdf/renderer 4.5 + ExcelJS 4.4** — deklaratív, dinamikus tördelésű PDF (kiváltja a jsPDF + pdfmake párost); stílusozott xlsx. Magyar ékezetekhez regisztrált Unicode TTF-font kell.
- **vite-plugin-pwa 1 (Workbox 7.4) + i18next 26 + react-markdown 10 + rehype-sanitize** — telepíthető PWA offline app-shell, HU-first i18n, Markdown-előnézet XSS-védelemmel.
- **Dev:** pnpm, Biome, Vitest 4, Playwright, GitHub Actions (kiváltja a hiányzó CI-t / lint-et).

**Nyitott kérdés (konfliktus):** a sync-backend iránya nem eldöntött — RxDB `replicateRxCollection` custom handler (saját PostgreSQL/Azure, `future_scaling.md` iránya) **vs.** Dexie + dexie-cloud-addon (turnkey termék). A választás a sync-mérföldkőre halasztható, de az RxDB most nem köti le. Szintén jelzendő: az ExcelJS lassuló karbantartása (pontos verzióra pinnelni), és a PITFALLS a pdfmake auto-tördelését emeli ki, míg a STACK a `@react-pdf/renderer`-t ajánlja — a végleges PDF-lib döntést az export-fázisban worst-case fixtúrán kell zárni.

### Expected Features

Az MVP a table-stakes réteget már lefedi. A verseny (Aha!, Dovetail, Productboard, ChatPRD) a guided discovery flow-t és a beszélgetés→követelmény transzformációt csinálja jól; a Project-Maker egyedi tétje a **determinisztikus coaching**. **Minden a kérdés-metaadat modellre épül** — ez a fundamentum, amit először és jól kell megtervezni. A **Markdown a kanonikus forrás**: az AC-generálás és a PDF/Excel export egyaránt a strukturált Markdown spec-ből származzon (single source of truth), ne a nyers válaszokból.

**Must have (table stakes):**
- Projekt-CRUD + lista/archívum; strukturált, guided kérdés-sorozat; auto-mentés (debounce)
- Haladás-jelző / completion %; readiness/döntési pontszám (playbook-súlyokhoz kötve)
- Ember-olvasható PDF + Excel export; könnyű követelmény-metaadat (ID, forrás, prioritás, státusz)
- Magyar UI + magyar kérdés/coaching-tartalom; utólagos szerkeszthetőség (recompute-on-edit)

**Should have (differenciálók):**
- **Kérdésenkénti coaching-panel (4 rovat)** — a fő differenciáló, piaci fehér folt
- Determinisztikus minőség-heurisztika: inline tippek + „jó válasz így néz ki" minták (AI nélkül)
- Nyitott kérdések auto-gyűjtése (a heurisztika mellékterméke) → táplálja a Markdown specet
- Projekttípus-specifikus playbookok; development-ready Markdown spec-csomag
- AC / user story generálás + INVEST/DoR ellenőrző; dinamikus tördelésű PDF/Excel; egységes interjú-mód UX

**Defer (v2+):**
- Opcionális LLM-augmentáció — csak miután a determinisztikus lánc teljes és validált
- Tényleges multi-user sync — külön mérföldkő; interjú-transzkripció / hang-input — nagy AI-függés

**Anti-features (scope-creep ellen):** kötelező élő AI, teljes DOORS/Jama traceability-mátrix, valós idejű együttszerkesztés most, naptár-integráció, transzkripció, merev egyutas wizard, gamifikáció, struktúra nélküli szabad szöveg.

### Architecture Approach

Rétegzett mag + ports-and-adapters. A **domain mag pure TS** (se React, se IO, se fetch), és csak portokat (interfészeket) ismer: `StoragePort`, `ContentPort`, `ExportPort`, `LlmPort`, `SyncPort`. Minden nyíl befelé mutat (dependency rule) — így a Tauri→web váltás, a sync becsatolása és az LLM be/kikapcsolása pusztán adapter-csere a peremen. A build-sorrend a függőségekből adódik és a roadmap vázát adja.

**Major components:**
1. **Adat-réteg (StoragePort + IndexedDB adapter)** — perzisztálás, séma-verzió/migráció, backup/restore; a sync-envelope itt jön létre és frissül.
2. **Domain mag** — felmérési/interjú engine (playbook-értelmezés, állapotgép), scoring/readiness, spec/AC/nyitott-kérdés deriválás (mind pure).
3. **Coaching/tartalom-réteg (ContentPort)** — kérdéshez kötött edukációs tartalom **adatként**, nem kódba égetve; olvasás-only, a felmérés-állapottól független.
4. **Output/export-réteg (ExportPort)** — domain → export view-model → serializer (MD-first, abból PDF/Excel).
5. **Opcionális LLM (LlmPort + NoopLlmAdapter)** és **Sync (SyncPort + NoopSyncAdapter)** — Null Object + feature flag a composition rootban (`app/container.ts`); most nincs megépítve, csak fogadóképes rá az architektúra.

### Critical Pitfalls

1. **Nincs stabil, globálisan egyedi ID** — vezess be ULID/UUIDv7-et minden entitáson MOST; relációk csak ID-ra. A legdrágábban visszamenőleg javítható döntés.
2. **Hard delete (zombie-rekordok)** — tombstone (`deleted_at`) soft-delete, a lekérdezések alapból `deleted_at IS NULL`-ra szűrnek.
3. **Blob-LWW / nincs per-mező merge** — normalizáltabb modell + per-mező `updated_at` + monoton `version` counter (Lamport/HLC-készenlét óra-skew ellen); nem CRDT.
4. **Séma-verziózás hiánya** — `schema_version` minden gyökér-rekordon + verzió-kulcsolt migrációs lánc az első web-verziótól; ez az MVP-adat migrációjának is előfeltétele.
5. **LLM-kulcs + CSP** — soha ne szállíts kulcsot a kliens-bundle-ben; BYOK session-scope, explicit PII-küldés-engedély, valódi kill switch. **A CSP bekapcsolása az AI előfeltétele.**
6. **Kliensoldali export-robbanás + PWA-cache beragadás** — tördelést natívan támogató PDF-motor + font-subset + worst-case fixtúra; Workbox precache + „új verzió elérhető" frissítés-prompt.

## Implications for Roadmap

A build-sorrend a dependency rule-ból adódik: előbb a mag és a szerződések (portok), aztán a peremek. Az 1–2. lépés nem halasztható; minden más adapter cserélhető később.

### Phase 1: Adatmodell / perzisztencia alapozó (blokkoló)
**Rationale:** Mindenre ez épül; az envelope/verziózás utólagos bevezetése adat-migrációt kényszerítene. A négy dimenzió egybehangzóan ezt teszi az első, nem-halasztható fázissá.
**Delivers:** Domain model + `Envelope<T>` (stabil ULID/UUIDv7 ID, `schema_version`, `revision`/monoton `version`, `updated_at`, `updated_by`/actor_id, `deletedAt` tombstone, `dirty`); migrációs keret (üres lánccal is); Zod runtime-validáció; `UserContext { userId: "local" }` stub.
**Addresses:** Séma-verziózás + backup/restore (PROJECT active constraint).
**Avoids:** Pitfall 1, 2, 3, 4, 12 (stabil ID, tombstone, per-mező timestamp, schema_version, óra-skew).

### Phase 2: Portok + Storage adapter + backup/restore
**Rationale:** A mag és a UI a port-szerződésekhez fejleszt; a felmérés-motor perzisztenciát igényel; a teszt-adapter kell a mag teszteléséhez.
**Delivers:** 5 port definíciója; IndexedDB (RxDB/Dexie) StorageAdapter + migrációs keret + in-memory teszt-adapter; teljes JSON export/import backup; `NoopSyncAdapter` + dirty/outbox könyvelés.
**Uses:** RxDB 17 (Dexie storage), Zod, `navigator.storage.persist()`.
**Implements:** Adat-réteg, StoragePort/SyncPort.
**Avoids:** Pitfall 5 (backup/validáció), 11 (sync-ready ≠ sync-implementáció).

### Phase 3: Felmérési/interjú engine + scoring + playbook/coaching tartalom-modell
**Rationale:** Csak a modellre és a StoragePortra támaszkodik; a UI erre épül. A tartalom adatként kezelése most dönt — később nehéz kiszedni a kódból.
**Delivers:** Kérdés-metaadat modell + 1-2 playbook; állapotgép/reducer felmérés-engine; scoring (a `recalculateProject` pure utódja); ContentPort + verziózott coaching-katalógus (miért/mit/hogyan/etikett); egységes guided interjú+checklist UI szabad navigációval.
**Addresses:** Table-stakes flow + a fő differenciáló coaching-panel.
**Avoids:** Pitfall 9 (coaching kódba égetve).

### Phase 4: Determinisztikus minőség-heurisztika + Markdown spec (kanonikus forrás)
**Rationale:** A minőség-szabálymotor egyszerre táplálja az inline tippet ÉS a nyitott-kérdés listát; a Markdown a single source of truth az exporthoz és AC-hez.
**Delivers:** Inline tippek + „jó válasz" minták; nyitott kérdések auto-gyűjtése; development-ready Markdown spec-csomag (determinisztikus template-motor).
**Addresses:** Elsődleges output (PROJECT kulcsdöntés).

### Phase 5: Export view-model + serializerek (MD → PDF/Excel) + AC/user story
**Rationale:** A generáláshoz kész domain-modell és stabil Markdown-forrás kell; MD-first sorrend.
**Delivers:** Export pipeline; dinamikus tördelésű PDF (@react-pdf/renderer, regisztrált ékezetes font) + stílusozott Excel (ExcelJS); AC/user story + INVEST/DoR ellenőrző.
**Avoids:** Pitfall 8 (export-robbanás — worst-case fixtúra, font-subset, egyetlen PDF-lib).

### Phase 6: PWA-héj + offline + CSP
**Rationale:** A store és UI köré csomagol; a CSP az AI előfeltétele.
**Delivers:** Workbox precache (hash-alapú), network-first app-shell, kontrollált frissítés-prompt UX; szigorú CSP; `rehype-sanitize`.
**Avoids:** Pitfall 6 (cache-beragadás), CSP-alapozás Pitfall 7-hez.

### Phase 7: MVP-adat migráció (webes GA előtt)
**Rationale:** A validáló MVP-nek valós felhasználói adata van; a `schema_version` + JSON export/import itt fizetődik ki.
**Delivers:** Tauri-MVP „exportálj mindent JSON-ba" + webes import; idempotens, nem-destruktív migráció valósághű fixtúrán tesztelve.
**Avoids:** Pitfall 10 (ad-hoc migráció).

### Phase 8 (v2+ / opcionális): LLM-augmentáció
**Rationale:** Szándékosan az utolsó — a determinisztikus pipeline kész kell legyen, hogy az LLM csak fölé dúsítson és ne váljon kötelező függőséggé.
**Delivers:** `LiveLlmAdapter` feature-flag mögött; BYOK session-scope; explicit PII-küldés-engedély.
**Avoids:** Pitfall 7 (kulcs/CSP), Anti-Pattern 2.

### Phase Ordering Rationale
- **Az 1–2. fázis (envelope + portok + schema_version) az egyedüli visszamenőleg drága döntés** — minden más adapter cserélhető később.
- A Markdown mint kanonikus forrás miatt a spec-generálás (4) megelőzi az exportot (5); az AC és a PDF/Excel egyaránt a Markdownból származik.
- Az LLM (8) és a valódi sync-transport **kifejezetten a mérföldkövön kívül / utolsó** — így egyik sem szivárog be kötelező függőségként a magba. Minden fázis success-criteria-ja: „AI és sync nélkül is teljes".

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (export):** a végleges PDF-lib döntés (@react-pdf/renderer vs pdfmake) worst-case fixtúrán, dinamikus tördelés + magyar font-subset; ExcelJS karbantartási kockázat.
- **Phase 3-4 (coaching + heurisztika):** a determinisztikus coaching/minőség-heurisztika konkrét mintái MEDIUM confidence — kevés direkt precedens, analógiából vezetve.
- **Phase 8 (LLM):** AI-SPEC contract kötelező; BYOK biztonsági minta.

Phases with standard patterns (skip research-phase):
- **Phase 1-2 (adatmodell/perzisztencia):** a local-first minták (envelope, tombstone, per-mező LWW, schema versioning) HIGH confidence, jól dokumentáltak.
- **Phase 6 (PWA):** Workbox precache + frissítés-UX bevált, dokumentált.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Perzisztencia/PDF/PWA/i18n/UI Context7 + npm-ellenőrzött; Zustand/React Router pontos patch MEDIUM; sync-backend és PDF-lib végleges választás nyitott. |
| Features | MEDIUM | Domain-gyakorlatok és versenytárs-funkciók HIGH; a determinisztikus coaching konkrét mintái MEDIUM (kevés precedens). |
| Architecture | HIGH | A local-first + hexagonális minták kiforrottak; a meglévő MVP port-csontja megerősíti. |
| Pitfalls | HIGH | Adatmodell/sync, PWA-cache, LLM-kulcs HIGH; kliensoldali PDF/Excel skálázás és migráció MEDIUM. |

**Overall confidence:** HIGH

### Gaps to Address
- **Sync-backend iránya:** saját PostgreSQL/Azure (RxDB custom replication) vs Dexie Cloud turnkey — döntés a sync-mérföldkőre halasztható; az RxDB most nem köti le. Kezelés: a Phase 1-2 backend-agnosztikus marad.
- **Végleges PDF-lib:** @react-pdf/renderer (STACK) vs pdfmake auto-tördelés (PITFALLS) — zárás az export-fázisban worst-case, ékezetes fixtúrán.
- **Determinisztikus coaching minták:** kevés direkt precedens — a Phase 3-4 discuss/plan során iterálni, valós felmérési tartalmon validálni.
- **ExcelJS karbantartás:** pontos verzióra pinnelni; menekülőút `write-excel-file`/`excel4node`.

## Sources

### Primary (HIGH confidence)
- **Context7** `/pubkey/rxdb`, `/dexie/dexie.js`, `/diegomura/react-pdf`, `/websites/dexie` — perzisztencia, replikáció, séma-migráció, PDF, Dexie versioning/upgrade.
- npm/hivatalos: React 19.2, Vite 8, Mantine 9 (React 19.2+ követelmény), @react-pdf/renderer 4.5, ExcelJS 4.4, vite-plugin-pwa 1 (Workbox 7.4), i18next 26, react-markdown 10.
- [web.dev Learn PWA — Update](https://web.dev/learn/pwa/update) — SW életciklus, frissítési UX.
- [OpenAI API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety); [AWS Hexagonal architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html).
- [INVEST — Agile Alliance](https://agilealliance.org/glossary/invest/), [AltexSoft User Stories 3 C's](https://www.altexsoft.com/blog/user-stories/), [Jama requirements guide](https://www.jamasoftware.com/requirements-management-guide/).
- Belső: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`.

### Secondary (MEDIUM confidence)
- Local-first architektúra és sync-minták: plainvanillaweb.com, techbasics.online, LogRocket, Evil Martians, debugg.ai, AppScale, Milan Jovanović (outbox), Patrick Jackson (CRDT-as-database).
- Coaching-UX: NN/G (contextual help), Userpilot (progresszív feltárás); discovery: Productboard, Product-Led Alliance.
- PDF-libek: Nutrient (jsPDF vs pdfmake, memória/font-subset); PWA-cache: DEV.to, Infinity Interactive.
- Versenytárs/AI-PRD: BuildBetter, Nimbalyst; LLM RE korlátai: arXiv 2310.13976.

### Tertiary (LOW confidence)
- Zustand 5.x / React Router 7.x pontos patch-verzió — npm-en ellenőrizni a planning során.

---
*Research completed: 2026-07-08*
*Ready for roadmap: yes*
