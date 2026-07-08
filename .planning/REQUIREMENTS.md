# Követelmények: Project-Maker

**Definiálva:** 2026-07-08
**Alapérték:** Egy ügyfél-felmérésből a lehető leggyorsabban konkrét, „agentic development"-re alkalmas, development-ready igény szülessen — miközben az app a használóját „junior → senior project leader" úton emeli.

## v1 Követelmények

Az induló mérföldkő követelményei. Mindegyik egy roadmap-fázishoz kapcsolódik.

### Adatmodell & perzisztencia (DATA)

- [ ] **DATA-01**: Minden entitás stabil, kliens-generált egyedi azonosítót (ULID/UUID) kap; a relációk kizárólag ID-ra hivatkoznak
- [ ] **DATA-02**: Minden gyökér-rekord sync-envelope-ot kap (`schema_version`, monoton `version`, `updated_at`, `updated_by`/actor, `dirty` flag)
- [ ] **DATA-03**: A törlés soft-delete (tombstone `deleted_at`); a listák alapból elrejtik a törölt rekordokat
- [ ] **DATA-04**: A séma verziózott, verzió-kulcsolt migrációs lánccal (üres lánccal is működik)
- [ ] **DATA-05**: Minden projekt-adat Zod-sémával validálódik mentés és betöltés előtt
- [ ] **DATA-06**: A felhasználó teljes adatmentést (backup) és visszaállítást (restore) tud készíteni JSON-ba/-ból

### Felmérési flow (SURVEY)

- [ ] **SURVEY-01**: A felhasználó projektet tud létrehozni, listázni, archiválni és törölni
- [ ] **SURVEY-02**: A felhasználót strukturált, guided kérdés-sorozat vezeti végig a felmérésen
- [ ] **SURVEY-03**: A válaszok automatikusan mentődnek (debounce-olva)
- [ ] **SURVEY-04**: A felhasználó projekttípus-specifikus playbook(ok) közül tud választani
- [ ] **SURVEY-05**: Egységes interjú+checklist felület, szabad navigációval a szekciók között
- [ ] **SURVEY-06**: Haladás-jelző (completion %) mutatja, mennyire kész a felmérés
- [ ] **SURVEY-07**: Readiness/döntési pontszám számítása a playbook súlyai alapján, a szerkesztések után újraszámolva

### Coaching / edukáció (COACH)

- [ ] **COACH-01**: Minden kérdéshez elérhető egy coaching-panel négy rovattal: *miért* fontos, *mit* ad technikailag, *hogyan* kérdezz business nyelven, tárgyalási *etikett*
- [ ] **COACH-02**: A coaching-tartalom adatként tárolt (nem kódba égetve) és verziózott
- [ ] **COACH-03**: A coaching-tartalom magyar nyelvű

### Minőség & nyitott kérdések (QUAL)

- [ ] **QUAL-01**: Determinisztikus (AI nélküli) minőség-jelzés: inline tippek a gyenge / hiányos válaszokhoz
- [ ] **QUAL-02**: Kérdésenként elérhető „jó válasz így néz ki" minta
- [ ] **QUAL-03**: A homályos / hiányos válaszokból automatikusan összeáll a nyitott kérdések listája

### Output & export (OUT)

- [ ] **OUT-01**: A felmérésből strukturált, development-ready Markdown spec-csomag generálódik (ez a kanonikus forrás)
- [ ] **OUT-02**: Acceptance criteria / user story generálás a spec-ből, INVEST/DoR ellenőrzővel
- [ ] **OUT-03**: Ember-olvasható PDF export dinamikus tördeléssel (a szövegdoboz a tartalom mennyiségéhez igazodik), magyar ékezetes fonttal
- [ ] **OUT-04**: Excel (xlsx) export stílusozva, sortöréssel és dinamikus oszlopszélességgel
- [ ] **OUT-05**: Az exportok a Markdown spec-ből származnak (single source of truth), és a válaszok szerkesztése után újragenerálhatók

### Platform / PWA (PWA)

- [ ] **PWA-01**: Az app telepíthető PWA-ként és offline is betölt (app-shell precache)
- [ ] **PWA-02**: Új verzió esetén kontrollált „frissítés elérhető" prompt jelenik meg (a cache nem ragad be)
- [ ] **PWA-03**: Szigorú CSP van érvényben, és a Markdown-előnézet XSS-védett (sanitizált)
- [ ] **PWA-04**: Magyar nyelvű UI i18n-keretben (nincs kódba égetett szövegliterál)

### Migráció (MIG)

- [ ] **MIG-01**: A meglévő (Tauri) MVP adatai JSON-ba exportálhatók és a webes appba importálhatók — nem-destruktív, idempotens módon

### Architektúra-előkészítés (PREP)

- [ ] **PREP-01**: Az LLM-integráció port mögött, kikapcsolható (alapból `NoopLlmAdapter`); az app AI nélkül teljes értékű
- [ ] **PREP-02**: A sync port mögött előkészített (`NoopSyncAdapter` + dirty/outbox könyvelés), de a tényleges szinkronizálás nincs megépítve

## v2 Követelmények

Későbbi kiadásra halasztva. Nyilvántartva, de nem része a jelenlegi roadmapnek.

### Opcionális élő AI (AI)

- **AI-01**: Élő LLM-adapter (`LiveLlmAdapter`) feature-flag mögött: válaszminőség-értékelés, utókérdés-javaslat, spec-generálás
- **AI-02**: BYOK (saját API-kulcs) session-scope, Web Crypto-titkosítással; explicit PII-küldés-engedély; valódi kill switch

### Multi-user sync (SYNC)

- **SYNC-01**: Tényleges felhő-szinkronizálás zárt körben (max 5 felhasználó)
- **SYNC-02**: Felhasználói authentikáció / identitáskezelés
- **SYNC-03**: Konfliktus-feloldás (per-mező LWW + jelzés) a párhuzamos szerkesztésekhez

### Bővített input (INPUT)

- **INPUT-01**: Interjú-jegyzet / hang-input transzkripció

## Out of Scope

Kifejezetten kizárva. Dokumentálva a scope-csúszás ellen.

| Funkció | Indok |
|---------|-------|
| Kötelező élő AI | Az app AI nélkül is teljes értékű kell legyen; az AI csak opcionális dúsítás |
| Teljes DOORS/Jama traceability-mátrix | Túlméretezett a célfelhasználói körhöz; a könnyű követelmény-metaadat elég |
| Valós idejű együttszerkesztés | A max 5 fős, aszinkron munkafolyamat nem indokolja most |
| CRDT-runtime | A max 5 fős skálán a per-mező LWW + version counter elég; a CRDT túl bonyolult |
| Naptár-integráció / auto-interjú-ütemezés | Nem a felmérés magja |
| Gamifikáció | Elvonja a fókuszt a szakmai értéktől |
| Mobil-natív alkalmazás | A web/PWA lefedi a hozzáférhetőséget |
| Struktúra nélküli szabad szöveg mint elsődleges input | A strukturált kérdés-modell a development-ready output előfeltétele |

## Traceability

Melyik fázis melyik követelményt fedi.

| Követelmény | Fázis | Státusz |
|-------------|-------|---------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| DATA-06 | Phase 1 | Pending |
| PREP-01 | Phase 1 | Pending |
| PREP-02 | Phase 1 | Pending |
| MIG-01 | Phase 1 | Pending |
| SURVEY-01 | Phase 2 | Pending |
| SURVEY-02 | Phase 2 | Pending |
| SURVEY-03 | Phase 2 | Pending |
| SURVEY-04 | Phase 2 | Pending |
| SURVEY-05 | Phase 2 | Pending |
| SURVEY-06 | Phase 2 | Pending |
| SURVEY-07 | Phase 2 | Pending |
| COACH-01 | Phase 2 | Pending |
| COACH-02 | Phase 2 | Pending |
| COACH-03 | Phase 2 | Pending |
| QUAL-01 | Phase 3 | Pending |
| QUAL-02 | Phase 3 | Pending |
| QUAL-03 | Phase 3 | Pending |
| OUT-01 | Phase 3 | Pending |
| OUT-02 | Phase 4 | Pending |
| OUT-03 | Phase 4 | Pending |
| OUT-04 | Phase 4 | Pending |
| OUT-05 | Phase 4 | Pending |
| PWA-01 | Phase 5 | Pending |
| PWA-02 | Phase 5 | Pending |
| PWA-03 | Phase 5 | Pending |
| PWA-04 | Phase 5 | Pending |

**Lefedettség:**
- v1 követelmények: 31 összesen
- Fázisokhoz rendelve: 31 ✓
- Nem rendelt: 0

---
*Követelmények definiálva: 2026-07-08*
*Utoljára frissítve: 2026-07-09 — roadmap 5 fázisra vonva (Phase 6/MIG-01 beolvasztva Phase 1-be)*
