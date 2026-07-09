# Roadmap: Project-Maker

## Overview

A Tauri-alapú, lokálisan validált desktop MVP-t web/PWA platformra emeljük, és egy egységes felmérési élménnyel + determinisztikus coaching-réteggel bővítjük. Az út az elkerülhetetlen adat-alapozással indul (sync-re felkészített adatmodell, hexagonális portok, perzisztencia, backup/restore és a meglévő Tauri-MVP adatainak nem-destruktív migrációja), majd fázisonként végpontig demózható, vertikális szeleteket szállít: guided felmérés + coaching, determinisztikus minőség-heurisztika + kanonikus Markdown spec, abból származó AC/user story és PDF/Excel export, végül a telepíthető PWA-héj (offline, CSP, i18n). Minden fázis „AI és sync nélkül is teljes" — az élő LLM-adapter és a tényleges felhő-sync szándékosan a mérföldkövön kívül (v2) marad; ebben a körben csak Noop-portok és a sync-envelope készül el.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Adat-alap, portok, perzisztencia és MVP-migráció** - Sync-re felkészített adatmodell, hexagonális portok, IndexedDB perzisztencia, backup/restore és a legacy Tauri-MVP adatainak nem-destruktív, idempotens importja (blokkoló alapozás) (completed 2026-07-09)
- [ ] **Phase 2: Felmérési flow és coaching** - Egységes guided interjú+checklist felület kérdésenkénti coaching-panellel
- [ ] **Phase 3: Minőség-heurisztika és Markdown spec** - Determinisztikus inline tippek, nyitott kérdések és kanonikus development-ready Markdown spec-csomag
- [ ] **Phase 4: Export és AC/user story** - A Markdown spec-ből származó acceptance criteria / user story és dinamikus tördelésű PDF/Excel export
- [ ] **Phase 5: PWA-héj, offline, biztonság és i18n** - Telepíthető, offline PWA szigorú CSP-vel, kontrollált frissítés-UX-szel és teljes magyar i18n-kerettel

## Phase Details

### Phase 1: Adat-alap, portok, perzisztencia és MVP-migráció

**Cél**: Sync-re felkészített, verziózott adatmodell és a hexagonális port-réteg áll; minden adat perzisztál, validálódik és menthető/visszaállítható, és a meglévő Tauri-MVP adatai nem-destruktívan behozhatók a webes domain-modellre — erre épül a teljes felület.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, PREP-01, PREP-02, MIG-01
**Success Criteria** (what must be TRUE):

  1. Minden entitás stabil, kliens-generált egyedi ID-t (ULID/UUID) kap, és minden gyökér-rekord sync-envelope-ot hordoz (`schema_version`, monoton `version`, `updated_at`, actor, `dirty`) — ellenőrizhető a perzisztált adatban; a relációk csak ID-ra hivatkoznak.
  2. A törlés soft-delete (tombstone `deleted_at`): a törölt rekordok alapból eltűnnek a listákból; minden mentés és betöltés Zod-sémán validálódik (a hibás adat elutasításra kerül).
  3. A felhasználó teljes JSON-backupot tud készíteni és visszaállítani; a séma verziózott, verzió-kulcsolt migrációs lánccal, amely üres lánccal is elindul.
  4. Mind az 5 port (Storage, Content, Export, Llm, Sync) definiált; az app alapból `NoopLlmAdapter` + `NoopSyncAdapter` mögött fut, dirty/outbox könyveléssel — AI és sync nélkül is teljes.
  5. A meglévő Tauri-MVP adata nem-destruktívan és idempotensen importálható a webes domain-modellre, Zod-sémákkal validálva, valósághű fixtúrán tesztelve (ismételt futtatás nem duplikál és nem ír felül meglévő adatot) — AI és sync nélkül is teljes.

**Plans**: 5/5 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: Envelope/Zod domain modell, RxDB StoragePort/adapter, routing + ProjectListView

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Soft-delete (tombstone) + verzió-kulcsolt migrációs lánc bizonyítása
- [x] 01-04-PLAN.md — Content/Export/Llm/Sync portok + Noop-adapterek + kompozíciós gyökér
- [x] 01-05-PLAN.md — Legacy Tauri-MVP import (MIG-01), szintetikus fixtúrán

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Teljes JSON backup/restore, látható UI-gombokkal

### Phase 2: Felmérési flow és coaching

**Cél**: A felhasználó projektet hoz létre és egy egységes, guided interjú+checklist felületen végigmegy egy felmérésen, kérdésenkénti coaching-panellel támogatva.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SURVEY-01, SURVEY-02, SURVEY-03, SURVEY-04, SURVEY-05, SURVEY-06, SURVEY-07, COACH-01, COACH-02, COACH-03
**Success Criteria** (what must be TRUE):

  1. A felhasználó projektet tud létrehozni, listázni, archiválni és törölni; egy strukturált guided kérdés-sorozaton szabadon navigálva megy végig (egységes interjú+checklist felület), és a válaszok debounce-olva automatikusan mentődnek.
  2. A felhasználó projekttípus-specifikus playbook(ok) közül választ; haladás-jelző (completion %) és a playbook-súlyokból számolt readiness/döntési pontszám mutatja az állapotot, szerkesztés után újraszámolva.
  3. Minden kérdéshez elérhető a négy-rovatos coaching-panel (*miért* fontos / *mit* ad technikailag / *hogyan* kérdezz / *etikett*), magyar nyelven, adatként tárolt és verziózott tartalomból (nem kódba égetve).
  4. A teljes felmérési és coaching élmény determinisztikus — AI és sync nélkül is teljes.

**Plans**: 1/8 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — React 19 + Mantine 9 + React Hook Form 7 + Zustand 5 stackváltás bevezetése
- [ ] 02-02-PLAN.md — Project.playbookId mező + RxDB séma-migráció + legacy MIG-01 import playbookId-backfill
- [ ] 02-03-PLAN.md — content/playbook katalógus (Általános playbook) + domain/scoring playbook-paraméteres motor
- [ ] 02-04-PLAN.md — content/coaching katalógus (30x4 magyar coaching-tartalom) + ContentPort adapter

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-05-PLAN.md — CreateProjectModal (playbook-választás) + ProjectListView create/archive/delete/filter kiterjesztés
- [ ] 02-06-PLAN.md — ChecklistCard + CoachingPanel + debounce-olt autosave + checklist UI-state store
- [ ] 02-07-PLAN.md — CockpitPanel + DecisionPanel + OverviewPanel (áttekintés, döntés, alapadatok)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-08-PLAN.md — SurveyView integráció (4 fül, autosave-újraszámolás, fixGap) + routing

**UI hint**: yes

### Phase 3: Minőség-heurisztika és Markdown spec

**Cél**: A determinisztikus minőség-motor gyenge válaszoknál inline tippet és mintát ad, összegyűjti a nyitott kérdéseket, és a felmérésből development-ready Markdown spec-csomagot állít elő — ez lesz a kanonikus forrás.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: QUAL-01, QUAL-02, QUAL-03, OUT-01
**Success Criteria** (what must be TRUE):

  1. Gyenge/hiányos válaszoknál inline tipp jelenik meg, és kérdésenként elérhető egy „jó válasz így néz ki" minta — AI nélkül, szabály-alapon.
  2. A homályos/hiányos válaszokból automatikusan összeáll és látható a nyitott kérdések listája.
  3. A felmérésből strukturált, development-ready Markdown spec-csomag generálódik, amely a további kimenetek kanonikus forrása (single source of truth).
  4. A minőség-jelzés és a spec-generálás teljesen determinisztikus — AI és sync nélkül is teljes.

**Plans**: TBD

Plans:

- [ ] 03-01: TBD

**UI hint**: yes

### Phase 4: Export és AC/user story

**Cél**: A kanonikus Markdown spec-ből acceptance criteria / user story és ember-olvasható PDF/Excel export készül, dinamikus tördeléssel, a válaszok szerkesztése után újragenerálva.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: OUT-02, OUT-03, OUT-04, OUT-05
**Success Criteria** (what must be TRUE):

  1. A Markdown spec-ből acceptance criteria / user story generálódik, INVEST/DoR ellenőrzővel.
  2. Ember-olvasható PDF export készül dinamikus tördeléssel (a szövegdoboz a tartalom mennyiségéhez igazodik) és magyar ékezetes fonttal.
  3. Stílusozott Excel (xlsx) export készül sortöréssel és dinamikus oszlopszélességgel.
  4. Minden export a Markdown spec-ből származik (single source of truth), és a válaszok szerkesztése után újragenerálható — AI és sync nélkül is teljes.

**Plans**: TBD

Plans:

- [ ] 04-01: TBD

### Phase 5: PWA-héj, offline, biztonság és i18n

**Cél**: Az app telepíthető PWA-ként, offline is betölt, kontrollált frissítés-UX-szel, szigorú CSP-vel és sanitizált Markdown-előnézettel, teljes magyar i18n-keretben.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PWA-01, PWA-02, PWA-03, PWA-04
**Success Criteria** (what must be TRUE):

  1. Az app telepíthető PWA-ként, és offline is betölti az app-shellt (precache).
  2. Új verzió esetén kontrollált „frissítés elérhető" prompt jelenik meg; a cache nem ragad be.
  3. Szigorú CSP van érvényben, és a Markdown-előnézet XSS-védett (sanitizált).
  4. A teljes UI magyar, i18n-keretben (nincs kódba égetett szövegliterál) — AI és sync nélkül is teljes.

**Plans**: TBD

Plans:

- [ ] 05-01: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Adat-alap, portok, perzisztencia és MVP-migráció | 5/5 | Complete    | 2026-07-09 |
| 2. Felmérési flow és coaching | 1/8 | In Progress|  |
| 3. Minőség-heurisztika és Markdown spec | 0/TBD | Not started | - |
| 4. Export és AC/user story | 0/TBD | Not started | - |
| 5. PWA-héj, offline, biztonság és i18n | 0/TBD | Not started | - |
