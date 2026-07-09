# Phase 2: Felmérési flow és coaching - Research

**Researched:** 2026-07-09
**Domain:** React 19 + Mantine 9 guided checklist UI, RxDB playbook/coaching adat-modell, determinisztikus readiness/decision scoring
**Confidence:** MEDIUM-HIGH (a stack-döntések HIGH — Phase 1 kutatásból lezártak és most újra-verifikáltak az npm registryn; a konkrét playbook/coaching adatmodell és a determinisztikus coaching-minta MEDIUM — kevés direkt precedens, ahogy a projekt-szintű kutatás is jelezte)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Playbook-struktúra és pontozás**
- **D-01:** A Phase 2 végén EGY playbook létezik ("Általános" — a jelenlegi legacy 30 tételes checklist tartalma), de a playbook-választás UI-ja és adatmodellje már többre felkészített (SURVEY-04 szerint). Projekt-típus-specifikus további playbookok később, valós felhasználói visszajelzés alapján.
- **D-02:** A playbook adatmodellje SAJÁT tétel-listát ÉS saját súly-konfigurációt definiál (nem csak súlyokat egy közös tétel-listához) — rugalmasabb jövőre nézve, egy jövőbeli "Belső IT" playbook más tételeket is tartalmazhat majd.
- **D-03:** A playbook a projekt létrehozásakor kerül kiválasztásra, és utólag NEM módosítható (playbook-váltás újraszámolást és adatvesztést jelentene — ez explicit nem-cél ebben a fázisban).
- **D-04:** A readiness/decision score számítás (`calculateReadinessPercent`/`calculateDecisionScore` mintája a legacy `project.ts`-ből) képlet-struktúrája megmarad, csak a súly-értékek jönnek a kiválasztott playbookból kódba-égetés helyett.

**Egységes interjú+checklist UX**
- **D-05:** Az alap UX-paradigma checklist-alapú: mind a 30 (playbook-)tétel egy kibontható kártya-listában jelenik meg, szabadon navigálható sorrendben. NEM külön lépés-lánc interjú-mód (a legacy `InterviewTab` mintája nem folytatódik önálló nézetként).
- **D-06:** A coaching-panel (4 rovat) automatikusan látható, amint egy tétel ki van bontva — nincs külön "segítség" gomb/kattintás.
- **D-07:** A Cockpit (áttekintés + hiányosság-lista) és a Decision (végső Go/No-Go döntés rögzítése) KÜLÖN nézet/tab marad — a SURVEY-05 egyesítés csak az interjú+checklistre vonatkozik, ezek más célt szolgálnak.
- **D-08:** A legacy `fixGap` minta megmarad: a Cockpit gap-listájában egy elemre kattintva a checklist-nézetre vált, kibontja és odagörget a megfelelő tételre.

**Coaching-tartalom szerzősége**
- **D-09:** Claude írja meg a teljes coaching-tartalmat (mind a 30 tételre × 4 rovat ≈ 120 szövegblokk) PM/PO discovery best practice-ek alapján, magyarul; a felhasználó utólag átnézi és finomítja. Nincs meglévő forrásanyag, amit be kellene hozni.
- **D-10:** A coaching-rovatok rövidek és pásztázhatók (1-2 mondat/rovat) — a felmérés KÖZBEN olvasandók, nem tréning-anyagként; nem hosszú, oktató jellegű bekezdések.
- **D-11:** A coaching-tartalom külön TS/JSON adatfájlban tárolódik, checklist-tétel ID-hoz kötve (pl. `src/domain/content/coachingContent.ts`), NEM a checklist-tétel/playbook definíció része (szemben a legacy `hint` mezővel) — könnyebben verziózható és később playbookonként szétválasztható.
- **D-12:** Mind a 30 tételre készül coaching-tartalom a Phase 2 végére — nincs részleges (csak kritikus/MVP-tételekre szűkített) lefedettség.

**Szabad navigáció és haladás-modell**
- **D-13:** A follow-up kérdések (legacy `FollowUpQuestion`, `sourceChecklistItemId` mezővel) az adott checklist-tétel kibontott kártyáján BELÜL jelennek meg — nincs külön "Follow-ups" nézet/tab.
- **D-14:** A tételek a jelenlegi kategória-sorrendben jelennek meg (Üzleti cél → Sikerkritérium → ... → Dokumentáció), de a felhasználó bármelyik tételre szabadon ugorhat/kattinthat — nincs kényszerített lépés-lánc, és nincs dinamikus "következő ajánlott tétel" jelzés sem (ez a Cockpit gap-listájának feladata marad, D-08 szerint).
- **D-15:** Belépéskor alapértelmezésben csak az első (vagy folytatáskor az első kitöltetlen) tétel van kibontva, a többi összecsukva — a legacy `new Set([1])` mintája szerint, de "első hiányzó tételre" általánosítva.
- **D-16:** A "mind kinyitása / mind becsukása" vezérlő (legacy `setAllChecklistItems` minta) megmarad az új egységes felületen is.

### Claude's Discretion
- A pontos playbook-adatstruktúra (TypeScript interfész alakja, fájl-elhelyezés a hexagonális rétegekben), a coaching-tartalom adatfájl pontos sémája, és a checklist-kártya komponens konkrét belső felépítése — a kutatás/tervezés dolgozza ki, a fenti döntések alapján.
- A 30 coaching-tartalom blokk konkrét szövegezése (Claude draft, D-09 szerint) — nem kérdezendő újra kérdésenként, a tervező/végrehajtó dolgozza ki PM/PO best practice alapon, majd a felhasználó felülvizsgálja végrehajtás után.

### Deferred Ideas (OUT OF SCOPE)
- További (projekt-típus-specifikus) playbookok — későbbi iteráció, valós felhasználói visszajelzés alapján (D-01).
- Playbook utólagos módosítása egy már létrehozott projekten — jövőbeli fázis, ha felmerül az igény (D-03).
- Dinamikus "következő ajánlott tétel" jelzés a checklist-navigációban — jelenleg a Cockpit gap-listája tölti be ezt a szerepet (D-14).
- Csak kritikus/MVP-tételekre szűkített coaching-lefedettség — elvetve, mind a 30 tételre készül tartalom (D-12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SURVEY-01 | Projekt létrehozás, listázás, archiválás, törlés | Lásd „Két különálló soft-delete mechanizmus" pitfall — `archivedAt` (üzleti flag) vs `StoragePort.softDelete` (envelope tombstone). `ProjectListView` már ad list/put/softDelete alapot (Phase 1); a create-flow és az archívum-szűrés Phase 2 új munkája. |
| SURVEY-02 | Strukturált, guided kérdés-sorozat | D-05 szerint checklist-alapú, NEM lépés-lánc — lásd Architecture Pattern 1 (Playbook-vezérelt checklist kártyalista). |
| SURVEY-03 | Debounce-olt automatikus mentés | Lásd Architecture Pattern 3 (React Hook Form `watch(callback)` + debounce → `StoragePort.put`). Code Example: debounced autosave hook. |
| SURVEY-04 | Playbook-választás | Lásd Architecture Pattern 2 (Playbook adatmodell: saját tétel-lista + saját súly-konfig, D-02) és a Standard Stack playbook-katalógus szekció. |
| SURVEY-05 | Egységes interjú+checklist, szabad navigáció | D-05/D-13/D-14 — Architecture Pattern 1 + „Checklist-kártya belső felépítése" Code Example. |
| SURVEY-06 | Haladás-jelző (completion %) | `calculateCompletion()` mintája megmarad, playbook-parametrizálva — lásd Architecture Pattern 4 (Scoring-modul kiemelése `domain/scoring/`-ba). |
| SURVEY-07 | Readiness/döntési pontszám playbook-súlyokból, újraszámolva | D-04 — Architecture Pattern 4; a `PlaybookWeights` típus és a `recalculateProject` playbook-paraméteres hívása. |
| COACH-01 | Kérdésenkénti 4-rovatos coaching-panel | D-06 — Architecture Pattern 5 (ContentPort + statikus coaching-katalógus); Common Pitfall „ContentPort jelenlegi `unknown` szerződése". |
| COACH-02 | Coaching-tartalom adatként tárolt, verziózott | D-11 — Standard Stack „Coaching-tartalom adatfájl" + Code Example (CoachingContent séma). |
| COACH-03 | Coaching-tartalom magyar nyelvű | D-09/D-10 — lásd „Coaching-szöveg szerzési útmutató" szekció (Common Pitfalls alatt). |
</phase_requirements>

---

## Summary

Ez a fázis a Phase 1 Walking Skeleton (`ProjectListView`, RxDB `StoragePort`, `Envelope<T>`, Zod-validáció) fölé építi a valódi terméket: projekt-CRUD, playbook-vezérelt guided checklist, kérdésenkénti coaching-panel és determinisztikus readiness/decision-pontozás. A meglévő legacy kód (`src/data/checklist.ts`, `src/lib/project.ts`, `ProjectDetailView.tsx` + tabs) **tartalmi mintaforrás**, nem szó szerint migrálandó kód — a scoring-logika és a 30 tételes checklist tartalma átül az új hexagonális rétegekbe (`domain/scoring/`, `content/playbook/`), a UI-réteg viszont teljesen újraépül Mantine 9 + React Hook Form + Zustand alapon, mivel Phase 1 explicit halasztotta ezt a stack-váltást ("a Mantine 9 kompatibilitás oka csak Phase 2-ben jelentkezik").

A legfontosabb új architektúra-döntés: a `Project` domain modell egy `playbookId: string` mezőt kap (D-03 szerint immutábilis), ami a `CURRENT_APP_SCHEMA_VERSION`-t 1→2-re emeli, és ez az **első valódi migrációs lépés** a Phase 1-ben lefektetett üres migrációs láncban (a Phase 1 walking-skeleton teszt-projektjei és a jövőbeli MIG-01-importok `playbookId: "general"` alapértelmezést kapnak upgrade-kor). A playbook saját tétel-listát és saját súly-konfigurációt definiál (D-02); a "Általános" playbook 1:1 a legacy `checklistTemplate` tartalma. A coaching-tartalom (COACH-01/02) egy különálló, `questionId`-re kulcsolt statikus adatkatalógus (`ContentPort` mögött, amely Phase 1-ben már létezik `unknown` visszatérési típussal — ezt a fázis tölti fel valódi sémával).

A UI-oldalon a fő döntés a **React 18.3.1 → 19.2.7 + Mantine 9.4.1 + React Hook Form 7.81 + Zustand 5.0.14** bevezetése, ahogy azt a Phase 1 SKELETON.md és a projekt-szintű STACK.md kutatás előre jelezte és most engedélyezte. A debounce-olt autosave-hoz a React Hook Form `watch(callback)` API a javasolt hook-pont (nem `useWatch`+`useEffect`, mert a dokumentáció explicit a render-fázisra optimalizáltnak jelöli azt, nem `useEffect`-függőségre).

**Primary recommendation:** Vezesd be a React 19 + Mantine 9 + RHF 7 + Zustand 5 stackváltást ebben a fázisban (ahogy azt a Phase 1 SKELETON.md előrevetítette); a playbook és coaching adatot tartsd `content/`-ben statikus, verziózott TS-modulként (nem RxDB-perzisztált projekt-adatként), és a scoring-logikát emeld ki `domain/scoring/`-ba playbook-paraméteres pure függvényekként — a `Project.playbookId` mező bevezetése kötelező, nem-triviális `schemaVersion` 1→2 migrációt igényel.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Projekt CRUD (create/list/archive/delete) | Domain Core (`domain/scoring`, `domain/model`) | Storage Adapter (RxDB) | A CRUD-logika (archívum-flag vs tombstone) domain-szabály; a perzisztencia a StoragePort mögött. |
| Guided checklist UI (kártyalista, szabad navigáció) | Browser/Client (React komponensfa) | Domain Core (scoring újraszámolás minden változáskor) | Tisztán kliensoldali render + interakció; minden mentés a domain scoring-on át megy vissza az adatrétegbe. |
| Coaching-panel tartalom (miért/mit/hogyan/etikett) | Domain Core (`ContentPort` + statikus katalógus) | Browser/Client (csak olvasás, render) | D-11 szerint adatként tárolt, verziózott — a UI csak megjeleníti, nem generálja. |
| Playbook-választás és -tárolás | Domain Core (`content/playbook/` + `Project.playbookId`) | Storage Adapter (RxDB migráció) | A playbook maga statikus tartalom (nem perzisztált egyedileg), de a kiválasztott ID a projekt-rekord része → storage-migrációt igényel. |
| Readiness/decision score számítás | Domain Core (`domain/scoring/`, pure) | — | D-04: a képlet-struktúra a mag felelőssége, IO nélkül; sosem tárolt, mindig újraszámolt (a legacy `recalculateProject` elve folytatódik). |
| Debounce-olt autosave | Browser/Client (React Hook Form `watch` + debounce hook) | Domain Core (`StoragePort.put` hívás) | A debounce UI-oldali időzítési döntés; az írás maga a StoragePorton megy át, ugyanúgy Zod-validálva. |
| Haladás-jelző (completion %) | Domain Core (`calculateCompletion`) | Browser/Client (render) | Már bizonyított pure-function minta a legacy `project.ts`-ből, csak playbook-parametrizálva. |

Ez a mérföldkő tisztán kliensoldali/local-first (nincs szerver-tier ebben a projektben) — a "CDN/Static" és "Database/Storage" tierek itt az IndexedDB/RxDB adaptert jelentik, nem külön backend szolgáltatást.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| **react** / **react-dom** | 19.2.7 | UI-réteg | `[VERIFIED: npm registry]` — `npm view react version` → 19.2.7. A Phase 1 SKELETON.md explicit halasztotta ide a 18→19 váltást, mert "a Mantine 9 kompatibilitás oka csak Phase 2-ben jelentkezik". |
| **@mantine/core**, **@mantine/hooks** | 9.4.1 | UI komponens- és design-rendszer | `[VERIFIED: npm registry]` — `npm view @mantine/core version` → 9.4.1. Mantine 9 kötelezően React 19.2+-t igényel (STACK.md „Version Compatibility"). Accordion komponens natívan fedi a checklist kártya expand/collapse mintát (D-15/D-16). |
| **react-hook-form** | 7.81.0 | Checklist-mezők + debounce-olt autosave | `[VERIFIED: npm registry]` — `npm view react-hook-form version` → 7.81.0. `watch(callback)` API-ja a nem-render-triggerelő subscription pont az autosave-hoz `[CITED: react-hook-form/documentation]`. |
| **@hookform/resolvers** | 5.4.0 | Zod↔RHF összekötés | `[VERIFIED: npm registry]` — 5.4.0 megerősítve. A meglévő `zod@4.4.3`-hoz illeszkedik (STACK.md Version Compatibility). |
| **zustand** | 5.0.14 | UI-only állapot (kibontott checklist-tételek Set-je, aktív playbook-választó modál) | `[VERIFIED: npm registry]` — 5.0.14 megerősítve. NEM a domain-adathoz (az RxDB reaktív lekérdezés marad a source of truth) — csak ideiglenes, nem-perzisztens UI-flag-ekhez. |
| **use-debounce** | 10.1.1 | Debounce-hook az autosave-hoz | `[VERIFIED: npm registry]` — 10.1.1 megerősítve, nincs postinstall script, tiszta repo. Kis, fókuszált könyvtár — ne írj kézzel `setTimeout`-alapú debounce-ot (Don't Hand-Roll). |
| **postcss-preset-mantine** + **postcss-simple-vars** (dev) | 1.18.0 / 7.0.1 | Mantine CSS-változók/mixinek PostCSS-ben | `[CITED: mantine.dev/guides/vite]` — Mantine hivatalos Vite-integrációs útmutatója kötelezővé teszi ezt a `postcss.config.cjs`-hez. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **rxdb**, **rxjs**, **zod**, **react-router** | 17.3.0 / 7.8.2 / 4.4.3 / 7.18.1 | Már telepítve Phase 1-ben | Változatlanul megmaradnak; a Project Zod-séma és az RxDB collection-séma bővül `playbookId`-vel, de a csomagok maguk nem cserélődnek. |
| **lucide-react** | ^0.468.0 (meglévő) | Ikonok | A legacy UI ezt használja (`ChevronDown`, `Gauge`, stb.); Mantine-nal is jól kombinálható, nem szükséges lecserélni Mantine saját ikon-rendszerére. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form `watch(callback)` debounce | `useWatch` + saját `useEffect` diffelés | A dokumentáció kifejezetten NEM ajánlja `useEffect` függőségként (`useWatch` render-fázisra optimalizált) — extra egyedi comparator-hook kellene, ami crash-kockázatosabb, mint a beépített `watch(callback)`. |
| Zustand a UI-state-hez | Plain `useState`/`useReducer` a checklist-view komponensben | 30 tételes kibontott-Set + globális "mind nyit/zár" vezérlés + Cockpit→Checklist `fixGap` scroll-and-expand cross-komponens hatás — Zustand egy megosztott store-t ad ok nélküli prop-drilling helyett; de ha a planner egyetlen komponensfába zárja az egészet, plain state is elég (STACK.md is csak "God-component felbontás" indokkal ajánlja). |
| Mantine Accordion | Kézzel épített `<details>`/CSS-alapú expand/collapse (legacy minta) | A legacy `checklist-item expanded/collapsed` CSS-osztály-minta működik, de a Mantine 9 bevezetésével (más okból, ld. fent) az Accordion natívan hozza az akadálymentességet (ARIA), a controlled multiple-open módot (D-16) és a stílusrendszert egy helyen. |

**Installation:**
```bash
pnpm add react@19 react-dom@19 @mantine/core@9 @mantine/hooks@9 \
  react-hook-form@7 @hookform/resolvers@5 zustand@5 use-debounce@10
pnpm add -D postcss-preset-mantine@1 postcss-simple-vars@7
```

**Version verification:** Minden fenti verzió `npm view <pkg> version` paranccsal ellenőrizve 2026-07-09-én (lásd Package Legitimacy Audit a pontos publish-dátumokért). A `react`/`react-dom`/`react-router`/`rxdb`/`zod` verziók megegyeznek a Phase 1 STACK.md és SKELETON.md ajánlásával — nincs eltérés a képzési adatokhoz képest.

---

## Package Legitimacy Audit

| Package | Registry | Age (utolsó publish) | Downloads/hét | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|---------------|--------------|---------|-------------|
| `react` | npm | 2026-06-01 | 146.1M | github.com/facebook/react | OK | Approved |
| `react-dom` | npm | 2026-06-01 | 138.4M | github.com/facebook/react | OK | Approved |
| `@mantine/core` | npm | 2026-06-28 | 1.85M | github.com/mantinedev/mantine | **SUS** ("too-new") | Flagged — planner checkpoint |
| `@mantine/hooks` | npm | 2026-06-28 | 2.12M | github.com/mantinedev/mantine | **SUS** ("too-new") | Flagged — planner checkpoint |
| `react-hook-form` | npm | 2026-07-05 | 55.9M | github.com/react-hook-form/react-hook-form | **SUS** ("too-new") | Flagged — planner checkpoint |
| `@hookform/resolvers` | npm | 2026-05-21 | 48.3M | github.com/react-hook-form/resolvers | OK | Approved |
| `zustand` | npm | 2026-05-28 | 41.9M | github.com/pmndrs/zustand | OK | Approved |
| `use-debounce` | npm | 2026-03-29 | 6.56M | github.com/xnimorz/use-debounce | OK | Approved |
| `postcss-preset-mantine` | npm | 2025-06-30 | 481.8K | github.com/mantinedev/postcss-preset-mantine | OK | Approved |
| `postcss-simple-vars` | npm | 2022-11-10 | 1.77M | github.com/postcss/postcss-simple-vars | OK | Approved |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `@mantine/core`, `@mantine/hooks`, `react-hook-form`. A seam `"too-new"` jelzést ad rájuk, ami a **legutóbbi kiadás publish-dátumára** vonatkozik, nem a csomag korára — mindhárom csomag évek óta létező, 1.8M–55.9M heti letöltésű, ismert GitHub-repóval rendelkező, aktívan karbantartott projekt (Mantine, React Hook Form), tehát ez valószínűsíthetően álpozitív egy friss patch-kiadás miatt, nem tényleges slopsquat-kockázat. Ennek ellenére a protokoll szerint a **tervezőnek (planner) `checkpoint:human-verify` lépést kell beszúrnia telepítés előtt** mindhárom csomagra, mielőtt a `pnpm add` parancs lefut — a felhasználó egy pillanat alatt vizuálisan megerősítheti (npm oldal, letöltésszám), hogy nem félreírt/typosquat névről van szó.

*A fenti csomagnevek WebSearch/képzési adatból lettek azonosítva, és `npm view`-val regisztry-hitelesítve — a Package Name Provenance szabály szerint ettől függetlenül `[ASSUMED]`-ként kezelendők amíg a `checkpoint:human-verify` meg nem történik a SUS-jelölt hármasra.*

---

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│  BROWSER / CLIENT (React 19 + Mantine 9, egyetlen SPA, RxDB/Dexie helyi)   │
│                                                                             │
│  [Projektlista nézet] ──"Új projekt"──▶ [Projekt-létrehozó modál]          │
│        │  (name + playbook select, D-03: playbook itt rögzül, végleges)   │
│        │                                        │                         │
│        │                                        ▼                        │
│        │                          storage.put(envelope+playbookId)        │
│        │                                                                   │
│        ▼ (projekt megnyitása)                                             │
│  [Projekt nézet — 3 belső fül]                                             │
│  ┌─────────────┐   ┌───────────────────────────┐   ┌───────────────────┐  │
│  │  Cockpit     │   │  Felmérés (interjú+       │   │  Döntés (Go/No-Go) │  │
│  │  (D-07:      │   │  checklist EGYESÍTVE,     │   │  (D-07: külön)     │  │
│  │  áttekintés+ │   │  D-05)                    │   │                    │  │
│  │  gap-lista)  │   │                           │   │                    │  │
│  └──────┬───────┘   │  [Checklist kártyalista]  │   └────────────────────┘  │
│         │           │   minden kártya:          │                          │
│         │ fixGap    │   ┌─────────────────────┐ │                          │
│         │ (D-08:    │   │ tétel fejléc + státusz│ │                          │
│         │ scroll+   │   │ (RHF mező, watch()   │ │                          │
│         │ expand)   │   │  debounce → autosave)│ │                          │
│         └──────────▶│   ├─────────────────────┤ │                          │
│                      │   │ kibontva (D-06):     │ │                          │
│                      │   │  Coaching panel      │◀┼── ContentPort.forQuestion│
│                      │   │  (miért/mit/hogyan/  │ │      (statikus katalógus,│
│                      │   │   etikett)            │ │       csak olvasás)      │
│                      │   │  + Follow-up mezők   │ │                          │
│                      │   │    (D-13, beágyazva) │ │                          │
│                      │   └─────────────────────┘ │                          │
│                      └───────────────────────────┘                          │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                 ▼
                    domain/scoring (pure, playbook-paraméteres)
             calculateCompletion(project, playbook) → completion (SURVEY-06/07)
                                 │
                                 ▼
                    StoragePort.put(envelope)  ──▶  RxDB/Dexie (IndexedDB)
                                 │
                                 ▼
                 reaktív lekérdezés (RxDB observable) ──▶ UI automatikus re-render
```

A "kérdés/válasz be" irány mindig: `RHF mező onChange → watch(callback) debounce → domain/scoring újraszámol → StoragePort.put → RxDB → reaktív re-render`. A coaching-olvasás egy teljesen független, csak-olvasó mellékág (nem ír a projekt-rekordba), ahogy azt a projekt-szintű `research/ARCHITECTURE.md` is előre specifikálta.

### Recommended Project Structure

```
src/
├── domain/
│   ├── model/
│   │   ├── envelope.ts          # (Phase 1, változatlan) CURRENT_APP_SCHEMA_VERSION → 2-re emelve
│   │   ├── types.ts             # Project += playbookId: string
│   │   └── schema.ts            # ProjectSchema += playbookId: z.string().min(1)
│   ├── scoring/                 # ÚJ — a legacy src/lib/project.ts logikájának pure otthona
│   │   ├── completion.ts        # calculateCompletion(project, playbook)
│   │   ├── readiness.ts         # calculateReadinessPercent(project, playbook)
│   │   ├── decisionScore.ts     # calculateDecisionScore(project, playbook, readinessPercent)
│   │   └── gaps.ts              # collectReadinessGaps(project, playbook)
│   └── ports/
│       ├── StoragePort.ts       # (Phase 1) — playbook NEM megy ide, statikus tartalom
│       └── ContentPort.ts       # (Phase 1, unknown-contract) — ez a fázis tölti fel valós sémával
├── content/                      # ÚJ — ADAT, nem kód (research/ARCHITECTURE.md mintája)
│   ├── playbook/
│   │   ├── types.ts             # Playbook, PlaybookItem, PlaybookWeights
│   │   ├── general.ts           # az "Általános" playbook (legacy checklistTemplate 1:1 átvéve)
│   │   └── index.ts             # playbooks: Record<string, Playbook> katalógus
│   └── coaching/
│       ├── types.ts             # CoachingContent { miert, mit, hogyan, etikett, version }
│       └── general.ts           # 30 bejegyzés, questionId-re kulcsolva (D-11)
├── adapters/
│   ├── storage/indexeddb/       # (Phase 1) — db.ts sémabővítés + migrationStrategies[1]
│   └── content/
│       └── staticContent.ts     # ContentPort implementáció — content/coaching/*-ból olvas
├── app/
│   ├── container.ts             # bővül: ContentPort bekötése staticContent-hez
│   └── store/
│       └── checklistUiStore.ts  # ÚJ — Zustand: kibontott tételek Set-je, "mind nyit/zár"
└── features/
    ├── projects/
    │   ├── ProjectListView.tsx  # bővül: valódi lista/archívum-szűrő/create-modál (Walking Skeleton → termék)
    │   └── CreateProjectModal.tsx  # ÚJ — playbook-select (1 opció most)
    └── survey/                   # ÚJ (research/ARCHITECTURE.md javasolt helye)
        ├── SurveyView.tsx        # Cockpit / Felmérés / Döntés belső fül-router
        ├── ChecklistCard.tsx     # egy playbook-tétel kártyája + beágyazott CoachingPanel + follow-up
        ├── CoachingPanel.tsx     # 4 rovat render (ContentPort-ból olvas)
        └── useAutosave.ts        # RHF watch(callback) + use-debounce + StoragePort.put wrapper
```

### Structure Rationale

- **`domain/scoring/` kiemelése:** a legacy `src/lib/project.ts` jelenleg importálja a globális `checklistTemplate`-et — ez a Phase 2 után helytelen volna, mert a playbook projektenként eltérhet. A scoring-függvények playbook-paramétert kapnak, nem globális importot.
- **`content/` mint statikus, nem RxDB-perzisztált adat:** sem a playbook, sem a coaching-tartalom nem projekt-specifikus rekord — ezek build-time/verziózott TS-modulok, amiket a domain csak beolvas. Ez konzisztens a Phase 1 `ContentPort` tervezett szerepével ("statikus tartalom-katalógus lookup").
- **`app/store/` (Zustand):** kizárólag UI-állapot (kibontott tételek), a domain-adat (checklistAnswers, completion) továbbra is az RxDB reaktív lekérdezésből jön — ez pontosan a STACK.md „a domain-adatot az RxDB adja, nem a Zustand" elve.

### Pattern 1: Playbook-vezérelt checklist kártyalista (nem lépés-lánc)

**Mi:** Egyetlen kártyalista, ahol minden kártya egy playbook-tételt (`PlaybookItem`) reprezentál; a felhasználó bármelyikre kattinthat (D-14), a kibontott állapotot egy Zustand `Set<string>` tartja (kártya-ID-k), nem route-paraméter.
**Mikor:** Ez az EGYETLEN felmérési UX-minta ebben a fázisban (D-05) — nincs alternatív interjú-mód.
**Példa (kibontott állapot store):**
```typescript
// app/store/checklistUiStore.ts
// Source: Zustand README (context7 /pmndrs/zustand) — Set state mindig új
// Set-példánnyal frissítendő, sosem mutálva a régit.
import { create } from "zustand";

interface ChecklistUiState {
  expandedItemIds: Set<string>;
  toggle: (itemId: string) => void;
  setAll: (itemIds: string[], open: boolean) => void;
  expandOnly: (itemId: string) => void;
}

export const useChecklistUiStore = create<ChecklistUiState>((set) => ({
  expandedItemIds: new Set(),
  toggle: (itemId) =>
    set((state) => {
      const next = new Set(state.expandedItemIds);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return { expandedItemIds: next };
    }),
  setAll: (itemIds, open) =>
    set({ expandedItemIds: open ? new Set(itemIds) : new Set() }),
  expandOnly: (itemId) => set({ expandedItemIds: new Set([itemId]) })
}));
```

### Pattern 2: Playbook adatmodell — saját tétel-lista + saját súly-konfig (D-02)

**Mi:** A `Playbook` típus NEM egy közös tétel-listára mutató súly-objektum, hanem önálló, teljes tétel-listát ÉS súly-konfigurációt hordoz — így egy jövőbeli 2. playbook (pl. "Belső IT") teljesen más tételeket definiálhat.
**Mikor:** Most, mert D-03 szerint a playbook-választás végleges — a modellnek elsőre helyesnek kell lennie.
```typescript
// content/playbook/types.ts
export interface PlaybookItem {
  id: number; // playbook-scope-on belül egyedi (ld. Pitfall "item-id ütközés")
  category: string;
  controlPoint: string;
  exampleQuestion: string;
  requiredForMvp: boolean;
  requiredForEstimate: boolean;
  blockingIfMissing: boolean;
}

export interface PlaybookWeights {
  // calculateReadinessPercent összetevők (D-04: a KÉPLET marad, csak az érték playbook-forrású)
  baseInfo: number;      // legacy: 0.2
  business: number;      // legacy: 0.2
  ownership: number;     // legacy: 0.15
  checklist: number;     // legacy: 0.3
  followUpResolution: number; // legacy: 0.15
  // calculateDecisionScore összetevők
  businessValue: number;        // legacy: 0.25
  strategicAlignment: number;   // legacy: 0.15
  urgency: number;               // legacy: 0.15
  confidence: number;            // legacy: 0.15
  complexity: number;            // legacy: 0.1 (inverted)
  risk: number;                  // legacy: 0.1 (inverted)
  readiness: number;              // legacy: 0.1
}

export interface Playbook {
  id: string;          // pl. "general" — ez kerül a Project.playbookId mezőbe
  name: string;         // "Általános" — megjelenítendő név
  version: number;      // COACH-02 szellemében a playbook maga is verziózott
  items: PlaybookItem[];
  weights: PlaybookWeights;
}
```

### Pattern 3: Debounce-olt autosave — React Hook Form `watch(callback)` (nem `useWatch`)

**Mi:** A checklist-mezők RHF `register`/`Controller` alatt élnek; egyetlen `watch(callback)` subscription figyeli az ÖSSZES mezőváltozást (nem trigger-el re-rendert), és egy debounce-olt `StoragePort.put()`-ot indít.
**Mikor:** Minden szerkeszthető checklist-mezőn (státusz, felelős, határidő, válasz, nyitott kérdés, következő lépés) és a projekt alapadat-mezőkön (SURVEY-03).
**Miért NEM `useWatch`+`useEffect`:** a hivatalos dokumentáció kifejezetten jelzi, hogy a `useWatch` "optimized for the render phase, not for `useEffect` dependencies" — értékösszehasonlításhoz külön custom hook kellene; a `watch(callback)` pontosan erre a non-render side-effect mintára való `[CITED: react-hook-form/documentation — useWatch.mdx, watch.mdx]`.
```typescript
// features/survey/useAutosave.ts
// Source: React Hook Form docs (context7 /react-hook-form/documentation, watch.mdx)
//         + use-debounce README
import { useEffect, useRef } from "react";
import type { UseFormWatch } from "react-hook-form";
import { useDebouncedCallback } from "use-debounce";

export function useAutosave<T>(watch: UseFormWatch<T>, onSave: (values: T) => Promise<void>) {
  const debouncedSave = useDebouncedCallback((values: T) => {
    void onSave(values);
  }, 600); // D-03 kontextusban elfogadható; nem UAT-kritikus konkrét ms-érték

  useEffect(() => {
    const { unsubscribe } = watch((values) => {
      debouncedSave(values as T);
    });
    return () => unsubscribe();
  }, [watch, debouncedSave]);
}
```

### Pattern 4: Scoring-modul kiemelése — playbook-paraméteres pure függvények (D-04)

**Mi:** A legacy `calculateReadinessPercent`/`calculateDecisionScore`/`calculateCompletion`/`collectReadinessGaps` (`src/lib/project.ts`) KÉPLETE 1:1 megmarad, de minden helyen, ahol eddig a globális `checklistTemplate`-et importálta, most egy `playbook: Playbook` paramétert kap.
**Mikor:** Minden mentéskor (`touchProject`/`recalculateProject` utódja) — sosem tárolt, mindig újraszámolt derived state elve (Phase 1 SUMMARY-ban is rögzített minta).
```typescript
// domain/scoring/readiness.ts — a legacy checklistWeightedRatio playbook-paraméteres verziója
function checklistWeightedRatio(project: Project, playbook: Playbook): number {
  const relevantItems = playbook.items.filter((item) => {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    return status !== "Nem releváns";
  });
  if (relevantItems.length === 0) return 1;
  const score = relevantItems.reduce((sum, item) => {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    if (status === "Kész") return sum + 1;
    if (status === "Részben megvan") return sum + 0.5;
    return sum;
  }, 0);
  return score / relevantItems.length;
}

export function calculateReadinessPercent(project: Project, playbook: Playbook): number {
  // ... ugyanaz a képlet, playbook.weights.* a legacy hardcoded 0.2/0.2/0.15/0.3/0.15 helyett
  return Math.round(
    (baseInfoScore * playbook.weights.baseInfo +
      businessScore * playbook.weights.business +
      ownershipScore * playbook.weights.ownership +
      checklistWeightedRatio(project, playbook) * playbook.weights.checklist +
      followUpResolutionRatio(project) * playbook.weights.followUpResolution) *
      100
  );
}
```

### Pattern 5: ContentPort valós sémával — coaching-tartalom csak-olvasás

**Mi:** A Phase 1 `ContentPort.forQuestion(questionId): Promise<unknown | null>` szerződése megmarad szó szerint (a Port fájlt nem kell módosítani — a szándékos `unknown` már felkészített erre), de egy `adapters/content/staticContent.ts` implementáció tölti fel valós adattal, és a feature-réteg egy típusos wrapper-függvényen (`getCoachingContent(questionId): CoachingContent | null`) keresztül castolja a Port válaszát a konkrét típusra.
**Mikor:** Minden kibontott checklist-kártyán (D-06 — automatikus, nincs külön "segítség" gomb).
```typescript
// content/coaching/types.ts
export interface CoachingContent {
  questionId: string;   // megegyezik a PlaybookItem.id-vel (playbook-scope-on belül)
  version: number;       // COACH-02: verziózott tartalom
  miert: string;         // miért fontos (1-2 mondat, D-10)
  mit: string;           // mit ad technikailag
  hogyan: string;        // hogyan kérdezz business nyelven
  etikett: string;       // tárgyalási etikett
}

// adapters/content/staticContent.ts
import type { ContentPort } from "../../domain/ports/ContentPort";
import { coachingCatalog } from "../../content/coaching/general";

export const staticContentAdapter: ContentPort = {
  async forQuestion(questionId: string) {
    return coachingCatalog[questionId] ?? null;
  }
};
```

### Anti-Patterns to Avoid

- **Coaching-tartalom checklist-tétel `hint` mezőjeként (legacy minta):** D-11 kifejezetten ez ellen dönt — a coaching-tartalom KÜLÖN fájlban, saját verzióval él, nem a playbook-tétel része, mert playbookonként eltérő coaching-lefedettség és külön iterációs ütem kell legyen.
- **`useWatch` + kézzel írt `useEffect` diff az autosave-hoz:** a hivatalos RHF-dokumentáció ezt kifejezetten nem erre a célra ajánlja (Pattern 3).
- **Globális `checklistTemplate` import a scoring-függvényekben:** ez a legacy minta pontosan azt a hibát okozná, hogy egy jövőbeli 2. playbook bevezetésekor minden meglévő projekt score-ja rosszul számolódna újra.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Debounce-olt mezőfigyelés | Kézzel írt `setTimeout`/`clearTimeout` wrapper minden mezőn | `use-debounce`'s `useDebouncedCallback` egyetlen helyen, a `watch(callback)` felett | Éles cleanup/race-condition kezelés (gyors egymás utáni változtatások, unmount közbeni timeout) már megoldott, tesztelt csomagban van. |
| Kibontható kártya + ARIA accessibility | Kézzel `<div>` + `aria-expanded` + fókusz-kezelés (legacy minta működik, de Mantine bevezetésével duplikáció) | Mantine `Accordion` (`multiple` mód D-16-hoz, `value`/`onChange` controlled D-15-höz) | Az ARIA/billentyűzet-navigáció, animáció, stílus egy karbantartott komponensben van; a legacy CSS-osztály-minta párhuzamos, redundáns UI-kódot jelentene a Mantine bevezetése MELLETT. |
| Form-mező validáció + hibaüzenet-megjelenítés | Kézi `useState` hibaobjektum minden mezőhöz | React Hook Form + `@hookform/resolvers` (Zod resolver) | A Zod-séma már létezik a domain rétegben (DATA-05) — az RHF Zod-resolver újrahasznosítja, nem duplikál validációs logikát. |
| Set-alapú UI-állapot mutáció | `expandedItems.add(x)` in-place mutáció (ismert React-hiba forrás) | Zustand store, MINDIG új `Set`-példány (`new Set(state.x)`) | A Zustand dokumentáció explicit figyelmeztet: in-place Set-mutáció nem vált ki re-rendert; ez pontosan az a hiba-osztály, amit a legacy `React.useState(() => new Set(...))` minta már helyesen kerül — az új store-nak ugyanezt a fegyelmet kell követnie. |

**Key insight:** ebben a fázisban a "hand-roll" kockázat elsősorban a UI-réteg időzítési/állapot-kezelési részleteiben rejlik (debounce, Set-mutáció, accordion-accessibility) — a domain-logika (scoring) helyesen a MEGLÉVŐ, bizonyított legacy képletet viszi tovább, ott NEM kell új mintát keresni, csak playbook-paraméterezni.

---

## Common Pitfalls

### Pitfall 1: `playbookId` bevezetése séma-migrációt igényel — ez lesz az ELSŐ nem-üres migrációs lépés

**What goes wrong:** ha a `Project.playbookId` mezőt egyszerűen hozzáadják a típushoz és a Zod-sémához anélkül, hogy az RxDB collection-sémát verziót lépnék és `migrationStrategies`-t írnának, a Phase 1-ben már létrehozott (Walking Skeleton teszt-)projektek `get()`/`list()` hívása Zod-hibával elszáll (`playbookId` hiányzik a régi rekordokból).
**Why it happens:** a `CURRENT_APP_SCHEMA_VERSION` (domain-szint) és az RxDB collection `version` (tár-szint) Phase 1 óta mindketten `0`/`1`-en állnak üres migrációs lánccal — ez az első alkalom, hogy tényleges mezőbővítés történik.
**How to avoid:** `CURRENT_APP_SCHEMA_VERSION` → 2; RxDB collection `version(1)` + `migrationStrategies: { 1: (oldDoc) => ({ ...oldDoc, data: { ...oldDoc.data, playbookId: "general" } }) }`; a Zod `ProjectSchema` `playbookId: z.string().min(1)`-t követel utólag is. `createEmptyProject()` faktor-függvény mostantól kötelező paraméterként várja a `playbookId`-t (nincs csendes alapérték, hogy a D-03 "véglegesség" ne sérüljön betöltéskor).
**Warning signs:** `tsc --noEmit` átmegy, de `pnpm test`/`pnpm dev` közben a Phase 1-es fixture-ök/StorageAdapter-tesztek Zod-parse-hibával elszállnak; RxDB `additionalProperties: false` miatt akár `put()` is dobhat, ha a mező `required`-ként szerepel a JSON-sémában, de a migráció nem futott le előbb.

### Pitfall 2: Két különálló "soft delete" mechanizmus összekeverése (SURVEY-01)

**What goes wrong:** a fejlesztő egyetlen mechanizmust épít archiválásra ÉS törlésre is, miközben a domain-modellben KÉT különböző fogalom él: `project.data.archivedAt` (üzleti archívum-flag, a legacy `archiveProject()` mintája szerint — a projekt továbbra is elérhető egy "Archívum" listában) és `StoragePort.softDelete(id)` (envelope-szintű `deletedAt` tombstone, ami a DATA-03 szerint MINDEN listából elrejti, sync-terjesztésre készül).
**Why it happens:** mindkettő "soft delete"-nek hangzik, és a legacy `App.tsx` `archiveProject`/`deleteProject` elnevezése nem egyértelműsíti a különbséget kódolvasás nélkül.
**How to avoid:** "Archiválás" gomb → `project.data.archivedAt = nowIso()` beállítás + `storage.put()` (a rekord VÁLTOZATLANUL listázható marad, csak egy "Archívum" szűrőnézetben); "Törlés" gomb → `storage.softDelete(id)` (a rekord egyetlen listából sem látszik többé, csak `get()`-tel érhető el). A `StoragePort.list()` jelenleg nem vesz fel szűrő-paramétert (Phase 1 interfész) — az Archívum-nézethez vagy egy kliensoldali szűrés (`list()` mindent visszaad, a UI szűr `archivedAt` alapján), vagy a `list(filter?: ListFilter)` port-bővítés (ARCHITECTURE.md Pattern 1 már előrevetíti ezt a szignatúrát) szükséges — ez tervezői döntés.
**Warning signs:** ha egy archivált projekt eltűnik MINDEN nézetből (beleértve egy jövőbeli "Archívum" szűrőt is), az annak a jele, hogy a `softDelete` lett hívva `archivedAt`-beállítás helyett.

### Pitfall 3: RxDB `additionalProperties: false` + opcionális mező bővítés (ismert Phase 1 buktató, ismétlődhet)

**What goes wrong:** a Phase 1 SUMMARY már dokumentálta, hogy egy nullable domain-mezőt (`deletedAt`) RxDB-ben `optional`-ként (nem `required`-ként) kell deklarálni a `properties`-ben, különben az RxDB alapértelmezett `additionalProperties: false` szigora eldobja az írást. Ugyanez a kockázat fennáll minden ÚJ mezőnél (`playbookId`), ha valaki elfelejti egyszerre bővíteni a `properties` ÉS a `required` tömböt az RxDB collection-sémában.
**Why it happens:** a Zod-séma és az RxDB JSON-séma két KÜLÖN helyen élnek (`domain/model/schema.ts` vs `adapters/storage/indexeddb/db.ts`) — nincs egyetlen forrás, ami automatikusan szinkronban tartaná őket.
**How to avoid:** minden mezőbővítésnél explicit ellenőrzőlista: (1) `domain/model/types.ts` TS-mező, (2) `domain/model/schema.ts` Zod-mező, (3) `adapters/storage/indexeddb/db.ts` RxDB `properties`+`required`, (4) `migrationStrategies` új verzió-lépés. A Phase 1 mintája (deletedAt) jó referencia, de FIGYELEM: `playbookId` sosem `null`, mindig kötelező string a `required`-ben — ez a Zod `required` mezőkkel egyezik, nem a `deletedAt` nullable-mintával.
**Warning signs:** `StorageAdapter.test.ts`-stílusú round-trip teszt (`put()` majd `get()` ugyanazt adja vissza) hirtelen RxDB-sémahibával bukik.

### Pitfall 4: Checklist item-ID ütközés egy jövőbeli 2. playbooknál

**What goes wrong:** ha a `PlaybookItem.id: number` mezőt (jelenleg 1-30, a legacy `checklistTemplate` 1:1 átvétele) egy jövőbeli playbook (Deferred, D-01) is 1-től kezdi számozni, a `Project.checklistAnswers: Record<number, ChecklistAnswer>` kulcsolása NEM playbook-scope-olt — bár ez Phase 2-ben nem okoz hibát (csak 1 playbook létezik), a modell tervezésekor érdemes tudatosan dokumentálni a jövőbeli korlátot.
**Why it happens:** a `checklistAnswers` mező típusa (`Record<number, ChecklistAnswer>`) globálisan kulcsol, nem `Record<string, ChecklistAnswer>` playbook-prefixált ID-val.
**How to avoid:** Phase 2-ben NEM kell megoldani (D-01 szerint a 2. playbook explicit halasztott) — de a `content/playbook/types.ts`-ben egy kommentben rögzítendő, hogy egy jövőbeli 2. playbook vagy (a) diszjunkt numerikus tartományt kell kapjon (pl. 1000+), vagy (b) a `checklistAnswers` kulcsot playbook-scope-olt string-re kell váltani (`"general:7"`) egy későbbi migrációval. Ez konzisztens a CONTEXT.md "Claude's Discretion" pontjával (a pontos adatstruktúra a tervezés dolga).
**Warning signs:** N/A ebben a fázisban (csak dokumentációs kockázat, nem futásidejű hiba).

### Pitfall 5: Mantine 9 Vite-integráció PostCSS-konfiguráció nélkül törik

**What goes wrong:** a Mantine 9 komponensek CSS-változói (pl. `--mantine-spacing-md`, reszponzív breakpoint-mixinek) nem oldódnak fel, ha a `postcss.config.cjs` hiányzik — a build lefut, de a komponensek stílus nélkül/hibásan jelennek meg.
**Why it happens:** Mantine 9 a stílusrendszerét PostCSS-preprocesszáláshoz tervezte (`postcss-preset-mantine` + `postcss-simple-vars`), ez NEM automatikus egy sima Vite+React scaffoldban.
**How to avoid:** `postcss.config.cjs` létrehozása a repo gyökerében a Mantine hivatalos Vite-útmutatója szerint (lásd Code Examples), ÉS a `@mantine/core/styles.css` (vagy a granulárisabb `baseline.css`/`default-css-variables.css`/`global.css` import-hármas) importálása a `main.tsx`-ben `MantineProvider` mellé.
**Warning signs:** a Mantine komponensek megjelennek, de teljesen stílus nélkül (natív böngésző-alapértelmezett kinézettel) vagy törött spacing/radius-értékekkel.

### Coaching-szöveg szerzési útmutató (D-09/D-10 operacionalizálása)

Mivel a projekt-szintű kutatás (`.planning/research/SUMMARY.md`) explicit MEDIUM-konfidenciásnak jelöli a "determinisztikus coaching-tartalom konkrét mintáit — kevés direkt precedens", az alábbi gyakorlati szerzési szabályokat érdemes a tervezőnek/végrehajtónak követnie a 30×4 blokk megírásakor (D-09/D-10 alapján, saját szintézis, nem külső forrásból):
- **`miert` (miért fontos):** 1 mondat, üzleti kockázat/érték nyelven (nem technikai), pl. "Enélkül a becslés utólag szétcsúszhat, mert a scope nem védhető."
- **`mit` (mit ad technikailag):** 1 mondat, mire használja fel a rendszer/csapat ezt az adatot (pl. becslési pontosság, tesztlefedettség-tervezés).
- **`hogyan` (hogyan kérdezz):** 1-2 konkrét, üzleti nyelvű kérdésmintázat — NE a `checklistTemplate.exampleQuestion` szó szerinti duplikálása, hanem kiegészítő/alternatív megfogalmazás (a `exampleQuestion` már a playbook-tétel része, a coaching `hogyan` ennél praktikusabb, tárgyalás-technikai szinten mozogjon).
- **`etikett` (tárgyalási etikett):** 1 mondat, mire figyeljen a kérdező interperszonálisan (pl. "Ne kérdőjelezd meg a válaszadó szakmai kompetenciáját, ha bizonytalan a számban — kérj konkrét példát helyette.").
- **Terjedelem-ellenőrzés:** minden rovat ≤ 2 mondat (D-10) — ha egy blokk 3+ mondatra nő, az tréning-anyag felé csúszik, nem munka-közbeni coaching.

---

## Code Examples

### Mantine + Vite PostCSS setup
```javascript
// postcss.config.cjs
// Source: https://mantine.dev/guides/vite (context7 /mantinedev/mantine)
module.exports = {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em"
      }
    }
  }
};
```

```tsx
// src/main.tsx — MantineProvider bevezetése a meglévő React Router 7 gyökér köré
// Source: https://mantine.dev/theming/mantine-provider (context7 /mantinedev/mantine)
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
// ... meglévő createBrowserRouter/RouterProvider import-ok változatlanul

createRoot(document.getElementById("root")!).render(
  <MantineProvider>
    <RouterProvider router={router} />
  </MantineProvider>
);
```

### Mantine Accordion — kontrollált, multiple mód (D-16 "mind nyit/zár")
```tsx
// Source: https://mantine.dev/core/accordion (context7 /mantinedev/mantine)
import { Accordion } from "@mantine/core";
import { useChecklistUiStore } from "../../app/store/checklistUiStore";

function ChecklistAccordion({ items }: { items: PlaybookItem[] }) {
  const expandedItemIds = useChecklistUiStore((s) => s.expandedItemIds);
  const toggle = useChecklistUiStore((s) => s.toggle);

  return (
    <Accordion
      multiple
      value={Array.from(expandedItemIds)}
      onChange={(values) => {
        // Accordion onChange a teljes új tömböt adja vissza; itt a store-t
        // szinkronba hozzuk vele (nem item-enkénti toggle-lel).
      }}
    >
      {items.map((item) => (
        <Accordion.Item key={item.id} value={String(item.id)}>
          <Accordion.Control>{item.category}</Accordion.Control>
          <Accordion.Panel>{/* ChecklistCard tartalom + CoachingPanel */}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
```

### RxDB migrationStrategies — `playbookId` bevezetése (Pitfall 1 megoldása)
```typescript
// adapters/storage/indexeddb/db.ts
// Source: RxDB migration pattern (research/ARCHITECTURE.md Pattern 3, projekt-szintű kutatásból átvéve)
const projectEnvelopeSchemaV1 = {
  ...projectEnvelopeSchema, // v0 séma (Phase 1)
  version: 1,
  properties: {
    ...projectEnvelopeSchema.properties,
    data: {
      ...projectEnvelopeSchema.properties.data,
      properties: {
        ...projectEnvelopeSchema.properties.data.properties,
        playbookId: { type: "string" }
      },
      required: [...projectEnvelopeSchema.properties.data.required, "playbookId"]
    }
  }
};

// migrationStrategies kulcsa a CÉL verzió (1), a függvény a v0 dokumentumot kapja
const migrationStrategies = {
  1: (oldDoc: OldEnvelopeDoc) => ({
    ...oldDoc,
    data: { ...oldDoc.data, playbookId: "general" }
  })
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| React 18.3.1 + kézzel épített form-mezők (`TextField`/`SelectField`) | React 19.2.7 + Mantine 9 + React Hook Form 7.81 | Phase 2 (ezt a fázist a Phase 1 SKELETON.md előre jelezte) | Kevesebb kézzel karbantartott UI-primitíva, beépített accessibility, teljesítmény-barát mezőfigyelés. |
| Kézi `refreshLists()`/`useState<Project[]>` (God-component minta) | RxDB reaktív lekérdezés + Zustand csak UI-state-hez | Phase 1 óta folyamatban, Phase 2 teljesíti ki | Automatikus re-render adatváltozásra, nincs kézi "refresh" hívás-lánc. |
| Checklist `hint` mező kódba ágyazva a tétel-definícióban | Külön `content/coaching/` katalógus, verziózott | Phase 2 (D-11) | A coaching-tartalom bővítése/finomítása nem érinti a playbook-tétel definíciót. |

**Deprecated/outdated:**
- A legacy `InterviewTab`/lépés-lánc interjú-mód: nem folytatódik önálló nézetként (D-05) — a kódrészlet referenciaként megmarad a repóban, de nem mountolódik az új felületen.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | A `@mantine/core`/`@mantine/hooks`/`react-hook-form` csomagnevek helyesek és nem typosquat-elnevezések, annak ellenére, hogy a legitimacy-seam "too-new" jelzést adott rájuk | Package Legitimacy Audit | Ha téves, egy hamis csomag telepszik — ezért a planner `checkpoint:human-verify`-t KELL beszúrjon telepítés előtt mindhárom csomagra. |
| A2 | A debounce-időzítés (600ms) elfogadható UX-érték az autosave-hoz | Pattern 3 (Code Example) | Ha túl rövid/hosszú, a felhasználó vagy túl sok írást generál, vagy érzi a mentés késleltetését — ez UAT-ban finomhangolható, nem architekturális kockázat. |
| A3 | A React 19 + Mantine 9 + RHF 7 + Zustand 5 kombináció zökkenőmentesen együttműködik egy meglévő RxDB 17 + react-router 7.18 + Vite 8 projektben (nincs ismert inkompatibilitás) | Standard Stack, State of the Art | A Phase 1 SKELETON.md és a projekt-szintű STACK.md ezt HIGH-konfidenciával már megalapozta, de a tényleges `pnpm add` + `tsc --noEmit` + `pnpm build` futtatás előtt nem 100%-ig bizonyított ebben a konkrét repóban — ha törik, a React 18.3 közbenső lépés (WebSearch-forrás szerint ajánlott) segíthet izolálni a hibát. |
| A4 | A coaching-szöveg szerzési útmutató (miert/mit/hogyan/etikett stílus-szabályok) helyes PM/PO discovery best practice — ez saját szintézis, nem külső, hitelesített forrásból | Common Pitfalls „Coaching-szöveg szerzési útmutató" | Alacsony kockázat — a felhasználó D-09 szerint úgyis átnézi/finomítja a tartalmat végrehajtás után; legfeljebb stílusbeli korrekció szükséges. |

**Ha ez a tábla üresnek tűnne:** nem üres — 4 tétel van, mindegyik alacsony-közepes kockázatú és a tervezés/UAT során kezelhető.

---

## Open Questions

1. **Marad-e külön "Alapadatok" (Overview) szekció/nézet a projekt alapadatoknak (név, ügyfél, PM/BA/PO/Tech Lead, kapcsolat, üzleti probléma/eredmény/MVP-cél)?**
   - What we know: a CONTEXT.md D-05/D-07 csak azt rögzíti, hogy az Interjú+Checklist egyesül és a Cockpit+Decision külön marad — az Overview-fület (legacy `OverviewTab.tsx`) SEHOL nem említi explicit sem megtartandóként, sem megszüntetendőként. Ugyanakkor ezek a mezők (`customerOrOrganization`, `productOwner`, `businessProblem`, `expectedBusinessOutcome`, `firstMvpGoal`, kapcsolat-mezők) közvetlenül bemennek a `calculateReadinessPercent`/`collectReadinessGaps` képletbe (D-04 szerint a képlet-struktúra megmarad) — tehát ezeknek a mezőknek MUTATNIA kell valahol a UI-n.
   - What's unclear: az Overview-mezők a projekt-létrehozó modálba kerülnek (minimális create-form), egy külön "Alapadatok" fülként élnek tovább a 3 fül (Cockpit/Felmérés/Döntés) mellett negyedikként, vagy a Cockpit tetején jelennek meg szerkeszthető mezőkként?
   - Recommendation: a tervező döntse el a UI-SPEC/PLAN.md szinten; javaslat: tartsd meg egy karcsú "Alapadatok" fület/szekciót (4. fülként vagy a Cockpit felett egy összecsukható panelként) — ez a legkisebb elmozdulás a bizonyított legacy struktúrától, és nem sérti egyik lezárt döntést sem (D-05/D-07 kifejezetten csak Interjú+Checklist-ről és Cockpit+Decision-ről szól).

2. **A `StoragePort.list()` bővül-e szűrő-paraméterrel (aktív/archivált), vagy a UI szűr kliensoldalon a teljes listán?**
   - What we know: a Phase 1 `StoragePort.list(): Promise<ProjectListItem[]>` jelenleg NEM vesz fel szűrőt; az `ARCHITECTURE.md` Pattern 1 viszont `list(filter?: ListFilter)` szignatúrát javasolt már a projekt-szintű kutatásban.
   - What's unclear: Phase 2 bővíti-e a portot, vagy elég egy kliensoldali `.filter(p => !p.archivedAt)`/`.filter(p => p.archivedAt)` a jelenlegi `list()` felett (mivel egyetlen felhasználónál a listaméret triviális).
   - Recommendation: a legegyszerűbb, port-módosítás nélküli út (kliensoldali szűrés) elég ehhez a mérethez (max néhány tucat projekt egy felhasználónál) — csak akkor bővítsd a portot, ha a tervező konkrét teljesítmény- vagy API-tisztasági okot lát rá.

3. **A `ContentPort` `unknown` visszatérési típusa bővül-e generikus paraméterrel Phase 2-ben, vagy marad `unknown` + feature-szintű type-cast?**
   - What we know: a Phase 1 `ContentPort.ts` fájl explicit kommentben tiltja egy `CoachingContent` típus feltételezését ("Do not invent a `CoachingContent` type here") — ez a Phase 1 plan hatóköre volt, nem feltétlen Phase 2-re vonatkozó tiltás.
   - What's unclear: a tervező bővítheti-e magát a `ContentPort.ts` fájlt (`forQuestion(id): Promise<CoachingContent | null>`), vagy inkább a `unknown` szerződést hagyja érintetlenül és a feature-rétegben végzi a típus-castolást/validációt (ahogy a Pattern 5 Code Example is mutatja).
   - Recommendation: hagyd érintetlenül a Port-fájlt (kisebb, biztonságosabb diff, nem bont Phase 1 szerződést), és végezz típusos wrapper-függvényt a feature-rétegben — ha a tervező mégis bővíteni akarja a Portot, az is elfogadható, csak akkor a Phase 1 kommentet is frissíteni kell.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | build/dev/test futtatás | ✓ | v24.16.0 | — |
| npm | csomag-lekérdezés/telepítés | ✓ | 11.13.0 | — |
| pnpm | a projekt kanonikus csomagkezelője (CLAUDE.md/package.json szerint) | ✗ (nem található ebben a shell-ben) | — | `npm`/`corepack enable pnpm` a végrehajtó agent környezetében ellenőrizendő újra; ha végleg hiányzik, a `pnpm-lock.yaml` karbantartásához a végrehajtó gépen mindenképp szükséges — ez NEM ehhez a kutatáshoz, hanem a plan végrehajtásához blokkoló, ha az adott execution-környezetben sem elérhető. |
| Context7 MCP (dokumentáció-lekérdezés) | kutatás | ✓ | — | — |
| npm registry (hálózat) | csomag-verzió/legitimacy-ellenőrzés | ✓ | — | — |

**Missing dependencies with no fallback:** nincs — a `pnpm` hiánya jelen kutatási környezetben nem blokkolja magát a kutatást; a végrehajtó (plan-execution) környezetben viszont ELLENŐRIZENDŐ újra, mert a `package.json` scriptjei (`tauri`, stb.) és a lockfile pnpm-specifikus.

**Missing dependencies with fallback:** `pnpm` → `npm`/`corepack`, ha a végrehajtási környezetben sem érhető el.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 |
| Config file | `vite.config.ts` (`test.environment: "jsdom"`, `test.setupFiles: "src/test/setup.ts"`) |
| Quick run command | `pnpm test` (vitest run) — cél-fájlra szűkítve: `pnpm vitest run src/domain/scoring` |
| Full suite command | `pnpm run checkpoint` (`typecheck && test && build`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SURVEY-01 | Projekt create/list/archive/delete round-trip | unit | `pnpm vitest run src/features/projects/ProjectListView.test.tsx` | ✅ (bővítendő) |
| SURVEY-02/05/14 | Checklist kártyalista szabad navigáció, kibontás | unit (component) | `pnpm vitest run src/features/survey/ChecklistCard.test.tsx` | ❌ Wave 0 |
| SURVEY-03 | Debounce-olt autosave ténylegesen hívja a `storage.put`-ot | unit | `pnpm vitest run src/features/survey/useAutosave.test.ts` | ❌ Wave 0 |
| SURVEY-04 | Playbook-választás a create-modálban, `playbookId` rögzül | unit (component) | `pnpm vitest run src/features/projects/CreateProjectModal.test.tsx` | ❌ Wave 0 |
| SURVEY-06/07 | `calculateCompletion`/`calculateReadinessPercent`/`calculateDecisionScore` playbook-paraméteres helyessége | unit | `pnpm vitest run src/domain/scoring` | ❌ Wave 0 (logika átemelve, tesztek is átemelendők/bővítendők) |
| COACH-01/02/03 | `ContentPort`/`staticContentAdapter` visszaadja a helyes 4-rovatos, magyar tartalmat egy adott `questionId`-re; hiányzó ID-nél `null` | unit | `pnpm vitest run src/adapters/content/staticContent.test.ts` | ❌ Wave 0 |
| (migráció) | RxDB `migrationStrategies[1]` helyesen tölti fel `playbookId: "general"`-t egy v0-séma dokumentumon | unit | `pnpm vitest run src/adapters/storage/indexeddb/StorageAdapter.test.ts` (bővített teszteset) | ✅ fájl létezik, teszteset bővítendő |

### Sampling Rate

- **Per task commit:** a task által érintett fájlra szűkített `pnpm vitest run <path>`.
- **Per wave merge:** `pnpm run checkpoint` (typecheck + teljes teszt-suite + build).
- **Phase gate:** teljes suite zöld `/gsd-verify-work` előtt.

### Wave 0 Gaps

- [ ] `src/domain/scoring/*.test.ts` — a legacy `src/lib/project.ts` scoring-tesztjeinek (ha vannak) átemelése playbook-paraméteres formába; ha nincs meglévő teszt a legacyben, új teszt írandó a legacy referencia-értékek ellen (30 tételes "Általános" playbook-bal visszaadva ugyanazt az eredményt, mint a régi hardcoded verzió).
- [ ] `src/features/survey/useAutosave.test.ts` — debounce időzítés tesztelése `vi.useFakeTimers()`-rel.
- [ ] `src/adapters/content/staticContent.test.ts` — ContentPort implementáció + a 30 coaching-bejegyzés jelenlétének smoke-tesztje (COACH-01/02 lefedettség-ellenőrzés: mind a 30 `PlaybookItem.id`-hez van `CoachingContent`).
- [ ] `src/adapters/storage/indexeddb/StorageAdapter.test.ts` bővítése egy migrációs teszttel (v0 dokumentum → v1 upgrade → `playbookId: "general"`).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Nem | Nincs hálózati/multi-user auth ebben a mérföldkőben (local-first, egyetlen `"local-user"` stub) — v2/SYNC scope-ban. |
| V3 Session Management | Nem | Nincs szerver-oldali session; a böngésző-tab élettartama a "session". |
| V4 Access Control | Nem | Egyetlen helyi felhasználó, nincs szerepkör-alapú hozzáférés-korlátozás ebben a mérföldkőben. |
| V5 Input Validation | Igen | Zod-validáció minden storage-boundary read/write-on (Phase 1 mintája folytatódik); az ÚJ `playbookId` mező és a `CoachingContent`/`Playbook` statikus adat is Zod-dal validálandó betöltéskor (még ha statikus TS-modulból jön is, egy build-time/teszt-idejű Zod-parse védelmet ad elgépelés/hiányos bejegyzés ellen). |
| V6 Cryptography | Nem | Nincs titkosítandó adat ebben a fázisban (a coaching-tartalom és a playbook nem szenzitív; a BYO-key LLM-titkosítás v2/Phase 5+ tárgya). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Hiányos/hibás `CoachingContent`/`Playbook` statikus adat build-időben észrevétlen marad, futásidőben `null`/`undefined` render-hibát okoz | Tampering (adat-integritás, nem rosszindulatú, de védendő) | Zod-séma a `content/playbook/`, `content/coaching/` moduljaira is (nem csak a perzisztált `Project`-re) — egy egyszerű smoke-teszt (`Object.values(coachingCatalog).forEach(c => CoachingContentSchema.parse(c))`) a Wave 0 gap-listában már szerepel. |
| A jövőbeli Markdown-előnézet (Phase 3-4) felhasználói szöveget (checklist `answer`/`openQuestion`/`nextStep`) fog renderelni — ha ez a fázis már beágyaz egy előnézet-komponenst, XSS-kockázat | Tampering/Information Disclosure (XSS) | Ebben a fázisban NINCS Markdown-render/`dangerouslySetInnerHTML` — a checklist-mezők plain-text `<input>`/`<textarea>` (React alapból escape-eli). Ha a tervező mégis bevezetne egy élő előnézetet, a projekt-szintű STACK.md már előírja a `rehype-sanitize`-ot — ez explicit NEM ennek a fázisnak a hatóköre, csak figyelmeztetés. |

---

## Sources

### Primary (HIGH confidence)
- `npm view <pkg> version` — minden Standard Stack csomag verziója közvetlenül a registryből ellenőrizve (react, react-dom, @mantine/core, @mantine/hooks, react-hook-form, @hookform/resolvers, zustand, use-debounce, postcss-preset-mantine, postcss-simple-vars, zod).
- `gsd-tools query package-legitimacy check` seam — minden új csomag verdiktje (OK/SUS) a Package Legitimacy Audit táblában.
- Belső, ebben a sessionben olvasott fájlok: `.planning/phases/01-.../01-CONTEXT.md`, `SKELETON.md`, `01-01-SUMMARY.md`, `src/domain/model/*.ts`, `src/domain/ports/*.ts`, `src/app/container.ts`, `src/features/projects/ProjectListView.tsx`, `src/data/*.ts`, `src/lib/project.ts`, `src/features/project-detail/**` — ezek adják a legacy scoring/UI minta és a Phase 1 kontraktusok pontos alakját.

### Secondary (MEDIUM confidence) — Context7 dokumentáció
- `/pubkey/rxdb` (context7) — `addCollections`, migrációs minta.
- `/react-hook-form/documentation` (context7) — `watch(callback)` vs `useWatch` API-szemantika.
- `/mantinedev/mantine` (context7) — `MantineProvider`/`createTheme` setup, Vite/PostCSS integráció, `Accordion` controlled state.
- `/pmndrs/zustand` (context7) — store-minta, Set-állapot frissítési szabály.
- `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md` (projekt-szintű kutatás, 2026-07-08) — a teljes stack-választás és a hexagonális rétegterv forrása; ezek HIGH-konfidenciásnak jelölték a stack-részt, itt csak megerősítettük az npm registry ellen.

### Tertiary (LOW confidence)
- WebSearch — "React 18 to React 19 migration breaking changes" — [react.dev hivatalos upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) és több harmadik-féltől aggregált cikk (bacancytechnology, learnwebcraft, mehdi.cz, Medium) összegzése; a react.dev-forrású állítások (18.3 közbenső lépés ajánlása, PropTypes/defaultProps eltávolítás) megbízhatóbbak, a harmadik-fél cikkek részletei nem külön-külön ellenőrzöttek.
- A "Coaching-szöveg szerzési útmutató" szekció — saját szintézis (Claude), nem külső forrásból, D-09/D-10 operacionalizálása.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — minden verzió npm registry ellen frissen ellenőrizve, konzisztens a Phase 1/projekt-szintű kutatással.
- Architecture (playbook/coaching adatmodell, scoring-kiemelés): MEDIUM — a hexagonális minta HIGH, de a konkrét playbook/coaching séma-alak új, nincs közvetlen külső precedens (a projekt-szintű `research/SUMMARY.md` is ezt jelezte előre).
- Pitfalls: MEDIUM-HIGH — a séma-migrációs és RxDB-specifikus buktatók a Phase 1 tényleges tapasztalatán alapulnak (nem feltételezés), a coaching-tartalom szerzési útmutató viszont saját szintézis.

**Research date:** 2026-07-09
**Valid until:** 2026-08-08 (30 nap — a csomagverziók/stack-döntések stabilnak tekinthetők, de a Package Legitimacy Audit SUS-jelöléseit érdemes újra-ellenőrizni, ha a plan végrehajtása jelentősen később kezdődik)
