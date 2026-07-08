# Architecture Research

**Domain:** Local-first, offline-képes, sync-re felkészített web/PWA felmérő és követelmény-elicitációs eszköz (PM/PO), coaching-réteggel és opcionális LLM-integrációval
**Researched:** 2026-07-08
**Confidence:** HIGH (a bevált local-first minták kiforrottak; a konkrét könyvtárválasztást a STACK dimenzió zárja le — itt könyvtár-agnosztikus mintákat adunk)

---

## Executive summary (a lényeg egy bekezdésben)

A local-first web/PWA rendszereket egy **rétegzett mag + ports-and-adapters (hexagonális) perem** kombinációjaként strukturálják. A **lokális store a single source of truth**; a hálózat (a jövőbeli sync) és az LLM egyaránt *opcionális periféria*, amit a domain mag egy porton (interfészen) keresztül ér el, sosem közvetlenül. A jelenlegi MVP-ben **már megvan** a helyes csont: `ProjectRepository` + `ProjectStorageAdapter` port (`storageTypes.ts`) + két adapter. A re-platforming feladata nem ennek eldobása, hanem: (1) a Tauri/SQLite adapter lecserélése egy böngésző-oldali IndexedDB adapterre, (2) minden rekord **sync-barát burokba** (envelope) csomagolása és **explicit séma-verzió** bevezetése, (3) egy **LlmPort** és egy **SyncPort** hozzáadása üres/no-op alapértelmezett adapterrel — így a sync és az LLM *ott van a felületen, de nincs megépítve*.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION (React + PWA)                       │
│  ┌────────────┐ ┌───────────────┐ ┌─────────────┐ ┌────────────────┐  │
│  │ Projekt-    │ │  Felmérési/    │ │  Coaching    │ │  Export /      │  │
│  │ lista/CRUD  │ │  interjú UI    │ │  panel (tipp)│ │  letöltés UI   │  │
│  └─────┬──────┘ └───────┬───────┘ └──────┬──────┘ └───────┬────────┘  │
│        │  React hooks (useLiveQuery / store-selectorok)   │           │
└────────┼────────────────┼────────────────┼───────────────┼───────────┘
         ▼                ▼                ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        DOMAIN CORE (pure TS, no React, no IO)          │
│  ┌────────────────┐ ┌──────────────────┐ ┌─────────────────────────┐  │
│  │ Interview/      │ │ Scoring / readiness│ │ Spec-/AC-/nyitott-kérdés │  │
│  │ Survey engine   │ │ (recalculate)     │ │ generátor (deriválás)   │  │
│  │ (sablon+állapot)│ │                   │ │                         │  │
│  └────────────────┘ └──────────────────┘ └─────────────────────────┘  │
│  A mag csak PORTOKAT ismer (interfészek), implementációt soha:         │
│  StoragePort │ ContentPort │ ExportPort │ LlmPort │ SyncPort           │
└───┬───────────────┬──────────────┬───────────┬──────────────┬─────────┘
    ▼               ▼              ▼           ▼              ▼
┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐
│ ADAPTEREK  │ │ Content    │ │ Export   │ │ LLM adapter  │ │ Sync adapter │
│ IndexedDB  │ │ adapter    │ │ adapterek│ │ ┌──────────┐ │ │ ┌──────────┐ │
│ (Dexie/    │ │ (statikus  │ │ MD / PDF │ │ │ Noop /    │ │ │ │ Noop      │ │
│  RxDB)     │ │  tartalom  │ │ / Excel  │ │ │ Determin. │ │ │ │ (most)    │ │
│ +migráció  │ │  + i18n)   │ │(kliens)  │ │ │ ↔ Live    │ │ │ │ ↔ HTTP    │ │
│ +backup    │ │            │ │          │ │ │  (opciós) │ │ │ │ (később)  │ │
│ └──────────┘ │            │ │          │ │ └──────────┘ │ │ └──────────┘ │
└────────────┘ └────────────┘ └──────────┘ └──────────────┘ └──────────────┘
     │                                                             ▲
     └───────────────── Outbox / change-log (sync-előkészítés) ────┘
                        most csak ír, nem küld
```

**Alapelv (dependency rule):** minden nyíl **befelé** mutat. A domain mag semmiről nem tud a peremen; az adapterek függnek a portoktól, a portok a domainban élnek, a domain semmitől nem függ. Ez teszi a syncet és az LLM-et utólag becsatolhatóvá a mag érintése nélkül. [hexagonal]

### Component Responsibilities

| Komponens | Miért felel (határ) | Tipikus megvalósítás |
|-----------|---------------------|----------------------|
| **Adat-réteg (StoragePort + adapter)** | Rekordok perzisztálása, lekérdezése, séma-verzió/migráció, backup/restore. A *sync-envelope* itt jön létre és itt frissül. | IndexedDB wrapper (Dexie vagy RxDB) egy `StorageAdapter` mögött; migrációk `version().stores().upgrade()` láncként. |
| **Felmérési/interjú engine** | Kérdés-sablon (playbook) értelmezése, felmérés-állapot vezetése (aktuális lépés, válaszok, feltételes ágak), haladás számítása. Pure logika, IO nélkül. | Deklaratív kérdés-séma (`data/`) + állapotgép/reducer; a válaszok a projekt-rekord részei. |
| **Coaching/tartalom-réteg (ContentPort)** | Kérdéshez kötött edukációs tartalom (*miért fontos, mit ad technikailag, hogyan kérdezz, etikett*) mint **adat**, nem kódba égetve. Inline tippek szabályai. | Statikus, verziózott tartalom-katalógus (JSON/MDX), `questionId → coaching content` kulcsolással; a UI csak olvassa. |
| **Output/export-réteg (ExportPort)** | Domain-modellből determinista serializálás: strukturált Markdown spec-csomag, AC/user story, nyitott kérdések, PDF, Excel. | Tiszta transzformációs pipeline (`Project → view-model → serializer`); kliensoldali PDF/Excel/MD generátorok külön adapterekként. |
| **Opcionális LLM-réteg (LlmPort)** | Válaszminőség-értékelés, utókérdés-javaslat, spec-dúsítás — **kizárólag opcionális dúsítás** a determinista kimenet felett. | Port-interfész + `NoopLlmAdapter` (alap) és `LiveLlmAdapter` (kapcsolóval); a mag mindig ad determinista eredményt LLM nélkül is. |
| **Sync-réteg (SyncPort)** | *MOST:* csak az envelope + outbox/change-log karbantartása. *KÉSŐBB:* push/pull adapter. | `SyncPort` interfész + `NoopSyncAdapter` most; a change-log az adat-rétegben gyűlik. |

---

## Recommended Project Structure

```
src/
├── domain/                 # A HEXAGON MAGJA — pure TS, se React, se IO, se fetch
│   ├── model/              # Típusok: Project, Answer, SurveyState, + Envelope<T>
│   │   ├── envelope.ts     # sync-burok: id, schemaVersion, revision, updatedAt/By, deletedAt
│   │   └── types.ts        # domain típusok (a mai src/data/types.ts utódja)
│   ├── survey/             # felmérési/interjú engine (állapotgép, feltételes ágak)
│   ├── scoring/            # readiness/decision számítás (recalculateProject utódja)
│   ├── generate/           # spec / AC / user story / nyitott-kérdés deriválás (pure)
│   └── ports/              # INTERFÉSZEK — a mag ezeket ismeri, semmi mást
│       ├── StoragePort.ts
│       ├── ContentPort.ts
│       ├── ExportPort.ts
│       ├── LlmPort.ts
│       └── SyncPort.ts
├── adapters/               # A HEXAGON PEREME — minden IO/infrastruktúra ide
│   ├── storage/
│   │   ├── indexeddb/      # Dexie/RxDB adapter + migrations/ + backup.ts
│   │   └── memory/         # teszt-adapter (in-memory)
│   ├── content/            # coaching tartalom-katalógus betöltő
│   ├── export/             # markdown.ts, pdf.ts, excel.ts (kliensoldali)
│   ├── llm/
│   │   ├── noop.ts         # alapértelmezett: nincs LLM (determinista)
│   │   └── live.ts         # opcionális, kikapcsolható valós LLM
│   └── sync/
│       └── noop.ts         # most: nem szinkronizál (envelope-t viszont vezeti)
├── content/                # ADAT: kérdés-sablonok (playbook) + coaching szövegek
│   ├── playbook/           # interjú/felmérés kérdés-sablonok (verziózott)
│   └── coaching/           # questionId → edukációs tartalom + tippek
├── app/                    # KOMPOZÍCIÓS GYÖKÉR: itt kötjük a portokat adapterekhez
│   ├── container.ts        # dependency wiring + feature flag-ek (llm on/off, sync off)
│   └── config.ts
├── features/               # React UI (a mai features/ szerkezet megtartható)
│   ├── projects/           # lista/CRUD
│   ├── survey/             # felmérési/interjú UI
│   ├── coaching/           # coaching panel
│   └── export/             # export UI
├── hooks/                  # useProjectList, useSurveyState, useExport (God-App feloldása)
└── ui/                     # design system, közös komponensek
```

### Structure Rationale

- **`domain/` vs `adapters/` szétválasztás:** ez a re-platforming egyetlen legfontosabb strukturális döntése. Ha a domain nem importál semmilyen IO-t (se Dexie, se fetch, se `@tauri-apps`), akkor a Tauri→web váltás, a sync becsatolása és az LLM be/kikapcsolása mind pusztán *adapter-csere* a peremen, a mag változatlan.
- **`domain/ports/`:** a MVP `storageTypes.ts`-je már egy port — ezt a mintát terjesztjük ki 5 portra. A portok a domainban élnek (a mag definiálja, mire van szüksége), az adapter alkalmazkodik hozzá — nem fordítva.
- **`content/` mint adat, nem kód:** a coaching- és playbook-tartalom külön verziózott adathalmaz. Így a tartalom bővítése/lokalizálása nem kódmódosítás, és a felmérés-motor tartalom-agnosztikus marad.
- **`app/container.ts` (composition root):** egyetlen hely, ahol eldől, melyik adapter aktív. A feature flag-ek (LLM be/ki) itt élnek — a UI és a domain nem tud róla, hogy épp Noop vagy Live adapter van bekötve.

---

## Architectural Patterns

### Pattern 1: Repository + Storage Port (adapter) — a meglévő csont megtartása

**Mi:** A domain egy `StoragePort` interfészen át perzisztál; a konkrét tár (IndexedDB most, HTTP a jövőben) adapter mögött van. A MVP `ProjectRepository`/`ProjectStorageAdapter` párosa pontosan ez — meg kell tartani, csak az adaptert cseréljük.
**Mikor:** Mindig, amikor a tárolási backend cserélhető kell legyen (desktop→web→cloud).
**Trade-off:** + Backend-független mag, tesztelhető in-memory adapterrel. − Egy extra absztrakciós réteg (5 usernél elhanyagolható költség).

```typescript
// domain/ports/StoragePort.ts — a mag ezt ismeri
export interface StoragePort {
  list(filter?: ListFilter): Promise<ProjectListItem[]>;
  get(id: string): Promise<Envelope<Project> | null>;
  put(record: Envelope<Project>): Promise<void>;   // upsert; a revisiont az adapter lépteti
  softDelete(id: string): Promise<void>;            // tombstone, NEM fizikai törlés
  exportBackup(): Promise<Blob>;                    // teljes dump (backup/restore)
  importBackup(blob: Blob): Promise<void>;
}
```

### Pattern 2: Sync-ready record envelope — a legfontosabb sync-előkészítés

**Mi:** Minden perzisztált entitást egy egységes **burokba (envelope)** csomagolunk, ami a syncnek szükséges metaadatot hordozza — de a sync-logikát *nem* építjük meg. A mai MVP a teljes `Project`-et JSON-blobként tárolja, verzió-diszkriminátor nélkül (lásd CONCERNS.md HIGH: „No Data Migration Path", „Untyped IPC blob"). Ezt oldja fel az envelope.
**Mikor:** MOST, minden entitásra — ez a legolcsóbb pillanat, mielőtt adat halmozódna fel régi formátumban.
**Trade-off:** + A jövőbeli sync tiszta rekord-szintű konfliktuskezelést kap (LWW vagy mező-szintű), pár usernél elég. − Kicsivel több írási könyvelés (revision léptetés, tombstone).

```typescript
// domain/model/envelope.ts
export interface Envelope<T> {
  id: string;              // stabil UUID (nem auto-increment!) — sync-kompatibilis kulcs
  schemaVersion: number;   // séma-verzió diszkriminátor a migrációhoz
  data: T;                 // maga a domain payload
  revision: number;        // monoton számláló ezen a klienzen (logikai óra magja)
  updatedAt: string;       // ISO időbélyeg (LWW tie-breaker)
  updatedBy: string;       // "local" most; user-id a sync-mérföldkőben (UserContext stub)
  deletedAt: string | null;// tombstone: soft-delete a sync-terjesztéshez
  dirty: boolean;          // van-e még nem-szinkronizált változás (a Noop sync figyelmen kívül hagyja)
}
```

**Miért pont ezek a mezők (a felmérésből visszaigazolva):**
- **UUID kulcs** auto-increment helyett: két kliens ütközésmentesen tud rekordot létrehozni offline. [local-first]
- **`updatedAt` + `revision`:** last-write-wins tie-breakerhez. Vektorórára/CRDT-re *most nincs szükség* (5 user, döntően nem-konkurens szerkesztés) — de az envelope kiegészíthető később `clock`-mezővel a mag érintése nélkül. A puszta timestamp-alapú LWW ismert kockázata az adatvesztés konkurens szerkesztésnél; 5 felhasználós, jellemzően nem-egyidejű használatnál ez elfogadható, és mező-szintű merge-re bővíthető, ha szükség lesz rá. [sync-patterns]
- **`deletedAt` tombstone:** fizikai törlés helyett — különben a sync nem tudná terjeszteni a törlést, és a törölt rekord „feltámadna" egy másik klienzről. Ez egyben megoldja a CONCERNS.md „No soft-delete/recycle" pontját is.
- **`dirty` flag + outbox:** lásd Pattern 4.

### Pattern 3: Explicit séma-verziózás és migrációs lánc

**Mi:** A séma-verzió nem opcionális — minden rekord `schemaVersion`-t hordoz, és az adat-réteg egy **migrációs láncot** futtat a régi verziójú rekordokon betöltéskor/DB-nyitáskor. Ez közvetlenül a CONCERNS.md HIGH figyelmeztetésére válasz („schema versioning hiánya blokkolja a migrációt").
**Mikor:** MOST — az első web-verzió legyen már `schemaVersion: 1`, migrációs kerettel, még ha üres is a lánc.
**Trade-off:** + Minden jövőbeli mezőbővítés/átnevezés biztonságos, visszamenőleg. − Fegyelmet igényel: minden séma-változás = új verzió + upgrade-lépés.

Dexie esetén ez natív (a verziók deklaratívak, az `upgrade()` csak akkor fut, ha a kliens alacsonyabb verzióról indul):

```typescript
// adapters/storage/indexeddb/db.ts  (Dexie példa — a pontos API a STACK-től függ)
db.version(1).stores({ projects: 'id, name, status, updatedAt, deletedAt' });

db.version(2)
  .stores({ projects: 'id, name, status, updatedAt, deletedAt, ownerId' })
  .upgrade(tx =>
    tx.table('projects').toCollection().modify(rec => {
      rec.data.ownerId = 'local';   // új mező visszatöltése régi rekordokra
      rec.schemaVersion = 2;
    })
  );
```

RxDB-nél ugyanez `migrationStrategies`-ként jelenik meg (verziónként egy tiszta függvény `oldDoc → newDoc`). Mindkettő ugyanazt a mintát valósítja meg: **verziónkénti, tiszta, előre-migráló függvény**. [Dexie versioning; RxDB]

> **Fontos:** a séma-verzió (`schemaVersion`, domain-szintű, a migrációs láncot vezérli) és az IndexedDB DB-verzió (Dexie `version(n)`, tár-szintű) két külön dolog — érdemes szinkronban tartani, de a domain migráció a rekord `schemaVersion`-jére kulcsoljon, hogy backup/restore és jövőbeli sync esetén is helyesen fusson (nem csak DB-nyitáskor).

### Pattern 4: Outbox / change-log — sync-előkészítés push nélkül

**Mi:** Minden íráskor a `dirty` flag beáll, és opcionálisan egy **change-log (outbox) tábla** rögzíti a mutációt (mit, mikor, melyik rekordon). MOST a `NoopSyncAdapter` ezt figyelmen kívül hagyja — de a napló ott van, amint a sync-mérföldkő megérkezik, csak „le kell szüretelni".
**Mikor:** MOST, ha alacsony költséggel akarjuk a jövőbeli deltás syncet megalapozni. Minimum a `dirty` flag; a teljes outbox opcionális, de olcsó.
**Trade-off:** + A sync-mérföldkő nem igényel adatmodell-migrációt. − Extra írási könyvelés (5 usernél lényegtelen).

```typescript
// A domain mag SyncPort-ot lát; most Noop van bekötve:
export interface SyncPort {
  markDirty(id: string): Promise<void>;          // most csak flag-el
  pending(): Promise<ChangeLogEntry[]>;          // később: mit kell felküldeni
  // push()/pull() SZÁNDÉKOSAN nincs — a sync-mérföldkő adja hozzá
}
```

### Pattern 5: Ports & Adapters az opcionális LLM-hez (Null Object + feature flag)

**Mi:** Az LLM egy `LlmPort` mögött él. Alapból egy **`NoopLlmAdapter`** (Null Object minta) van bekötve, ami determinista, „üres" választ ad — így a domain mag *sosem* feltételezi, hogy van LLM. Egy feature flag a composition rootban kapcsol `LiveLlmAdapter`-re. Ez teljesíti a PROJECT.md kemény korlátját: „az app AI nélkül is teljes értékű".
**Mikor:** Mindig, ha egy képesség opcionális/kikapcsolható kell legyen és nem lehet kötelező függőség.
**Trade-off:** + Az LLM be/ki egyetlen flag; a UI és a mag változatlan; a tesztek Noop-pal futnak; a provider (OpenAI/helyi/…) cserélhető adapter-szinten. − A domain a legkisebb közös nevezőre (Noop is teljesíti) kell tervezze a portot.

```typescript
// domain/ports/LlmPort.ts
export interface LlmPort {
  rateAnswer(q: Question, a: Answer): Promise<QualityHint>;      // Noop: "n/a"
  suggestFollowups(ctx: SurveyState): Promise<string[]>;         // Noop: []
  enrichSpec(spec: SpecDraft): Promise<SpecDraft>;               // Noop: visszaadja változatlanul
}

// adapters/llm/noop.ts — ALAPÉRTELMEZETT
export const noopLlm: LlmPort = {
  async rateAnswer() { return { level: 'unknown' }; },
  async suggestFollowups() { return []; },
  async enrichSpec(spec) { return spec; },   // identitás: a determinista kimenet marad
};

// app/container.ts — a döntés EGY helyen van
const llm: LlmPort = config.llmEnabled ? liveLlm(config.llm) : noopLlm;
```

**Kulcs-szabály:** az LLM sosem *előfeltétele* semmilyen kimenetnek. A determinista pipeline (sablon + scoring + generátor) mindig teljes spec-et állít elő; az LLM csak *fölé dúsít* (`enrichSpec` identitás Noop esetén). Így az „opcionális" nem UI-trükk, hanem architekturális invariáns. [hexagonal LLM]

### Pattern 6: Export mint tiszta pipeline (domain → view-model → serializer)

**Mi:** Az export nem közvetlenül a nyers `Project`-ből dolgozik, hanem egy köztes **export view-modellből**, amit a domain állít elő; a serializerek (MD/PDF/Excel) csak ezt a view-modellt fordítják formátumra. Kliensoldali, backend nélkül.
**Mikor:** Több kimeneti formátumnál (itt: MD, PDF, Excel), hogy a formázás-logika ne duplázódjon.
**Trade-off:** + Új formátum = új serializer, a deriválás közös. + A Markdown lehet az elsődleges (AI-barát) forrás, amiből a többi is levezethető. − Egy extra köztes modell.

---

## Data Flow

### Írási (felmérés-kitöltés) folyamat — explicit irány

```
[Felhasználó válaszol egy kérdésre]
      ↓
[Survey UI] → onChange → [useSurveyState hook]
      ↓
[domain/survey engine]  (állapot frissítés, feltételes ágak kiértékelése)  — PURE
      ↓
[domain/scoring]  (readiness/decision újraszámítás)                        — PURE
      ↓
[StoragePort.put(envelope)]   → revision++, updatedAt=now, dirty=true
      ↓
[IndexedDB adapter]  (Dexie/RxDB tranzakció)
      ↓                              ↘
[perzisztálva lokálisan]        [SyncPort.markDirty]  → Noop (most nem küld)
      ↓
[useLiveQuery / store subscription] → [UI automatikus re-render friss adatból]
```

**Irány:** UI → domain (pure) → StoragePort → adapter → IndexedDB. Visszafelé a reaktív lekérdezés (pl. Dexie `useLiveQuery`) tolja a friss adatot a UI-ba — a lokális store a source of truth, a komponens onnan renderel. [Dexie live query]

### Coaching-tartalom folyamat (olvasás-only, mellékág)

```
[Aktuális kérdés (questionId)]
      ↓
[ContentPort.forQuestion(questionId)]
      ↓
[Content adapter] → statikus coaching-katalógus lookup (miért/mit/hogyan/etikett + tipp-szabályok)
      ↓
[Coaching panel]  (a válasz-adattól FÜGGETLEN olvasás; nem ír a projekt-rekordba)
```

A coaching-réteg **csak olvas** és nincs a felmérés-állapothoz kötve írásban — így bővíthető/lokalizálható a motor érintése nélkül.

### Export folyamat

```
[Export UI: formátum + projekt(ek) kiválasztása]
      ↓
[StoragePort.get] → Envelope<Project>[]
      ↓
[domain/generate] → ExportViewModel (spec-csomag, AC/user story, nyitott kérdések)  — PURE
      ↓        ↘ (ha llmEnabled) [LlmPort.enrichSpec] — opcionális dúsítás
[ExportPort.serialize(viewModel, format)]
      ↓
[MD / PDF / Excel adapter]  (kliensoldali generálás → Blob)
      ↓
[Böngésző letöltés / File System Access API]
```

### Alkalmazás-inicializálás

```
[main.tsx] → [app/container.ts: portok bekötése adapterekhez + flag-ek olvasása]
      ↓
[IndexedDB adapter init] → DB-nyitás → migrációs lánc lefuttatása (schemaVersion → aktuális)
      ↓
[React root mount] → useLiveQuery-alapú listák betöltése
```

---

## Javasolt build-sorrend (függőségek a komponensek között)

A sorrend a **dependency rule**-ból adódik: előbb a mag és a szerződések (portok), aztán a peremek. Ez egyben a roadmap-fázisok természetes vázát adja.

| # | Építési lépés | Miért ekkor (függőség) | Downstream következmény |
|---|---------------|------------------------|-------------------------|
| **1** | **Domain model + Envelope + schemaVersion** (`domain/model`) | Mindenre ez épül; az envelope/verziózás utólagos bevezetése adat-migrációt kényszerítene. | Ha ezt kihagyjuk, minden később tárolt rekord régi formátumban ragad (CONCERNS.md HIGH). **Ez az első fázis, nem lehet halasztani.** |
| **2** | **Portok definiálása** (`domain/ports`: Storage/Content/Export/Llm/Sync) | A mag és a UI ezekhez a szerződésekhez fejleszt; az adapterek ezt implementálják. | A portok stabil szerződések; ha később bővülnek, az adapterek törnek — érdemes a Noop-okat is korán megírni, hogy a szerződés „valós". |
| **3** | **IndexedDB StorageAdapter + migrációs keret + in-memory teszt-adapter** | A felmérés-motor és a UI perzisztenciát igényel; a teszt-adapter kell a mag teszteléséhez. | A migrációs keret üres lánccal is legyen kész — így a 2. séma-változás olcsó. Backup/restore itt kap helyet (CONCERNS.md HIGH). |
| **4** | **Felmérési/interjú engine + scoring** (`domain/survey`, `domain/scoring`) | Csak a modellre és a StoragePortra támaszkodik; a UI erre épül. | A MVP `recalculateProject` logikája ide migrál pure formában. |
| **5** | **Playbook + coaching tartalom-adatmodell + ContentPort adapter** (`content/`) | A felmérés-motornak kell a kérdés-sablon; a coaching a kérdésekre kulcsol. | A tartalom adatként való kezelése most dönt — később nehéz kiszedni a kódból. |
| **6** | **Export view-model + serializerek** (MD → PDF/Excel) (`domain/generate`, `adapters/export`) | A generáláshoz kész domain-modell és kitöltött felmérés kell (1,4). | A Markdown-first sorrend: előbb MD, abból vezethető a PDF/Excel. A MVP `jspdf`/`pdfmake` teher újraértékelendő (CONCERNS.md). |
| **7** | **PWA-héj + offline (service worker, app-shell cache)** | Csak akkor van értelme, ha a store és a UI kész; a PWA a store köré csomagol. | Offline „rugalmas" cél — ez később/párhuzamosan is jöhet, nem blokkol funkciót. |
| **8** | **NoopSyncAdapter + dirty/outbox könyvelés** | Az envelope (1) és a StoragePort (3) előfeltétel. | A tényleges push/pull **külön mérföldkő** — itt csak a napló gyűlik. |
| **9** | **LlmPort LiveAdapter (opcionális)** | A determinista pipeline (4,6) kész kell legyen, hogy az LLM csak *fölé* dúsítson. | Ha ezt előbb építenénk, kockáztatnánk, hogy az LLM kötelező függőséggé válik — sorrendben utolsó, hogy az „opcionális" invariáns megmaradjon. |

**A sorrend két kritikus következménye:**
- **Az 1. és 2. lépés (envelope + portok) nem halasztható** — ezek az egyedüli visszamenőleg drága döntések. Minden más adapter cserélhető később.
- **Az LLM (9) szándékosan az utolsó**, és a sync-push kifejezetten a mérföldkövön kívül van — így egyik sem szivárog be kötelező függőségként a magba.

---

## Hogyan tegyük sync-re felkészítetté MOST, a sync megépítése nélkül (összefoglaló)

1. **Envelope minden rekordon** (Pattern 2): `id` (UUID), `schemaVersion`, `revision`, `updatedAt`, `updatedBy`, `deletedAt`, `dirty`.
2. **UUID kulcs auto-increment helyett** — ütközésmentes offline rekord-létrehozás.
3. **Soft-delete (tombstone)** fizikai törlés helyett a StoragePorton keresztül.
4. **`schemaVersion` + migrációs lánc** (Pattern 3) az első verziótól — CONCERNS.md HIGH feloldása.
5. **`SyncPort` + `NoopSyncAdapter`** bekötve (Pattern 4): a szerződés létezik, a `dirty`/change-log gyűlik, de nem küld semmit.
6. **`UserContext` stub** (`{ userId: "local" }`) átvezetve a StoragePorton — a CONCERNS.md MEDIUM javaslata; a valós auth a sync-mérföldkővel érkezik, de a felület már megvan.
7. **Backup/restore** a StoragePorton (`exportBackup`/`importBackup`) — teljes JSON dump, ami egyben a legegyszerűbb „migrációs út" a jövőbeli backendhez (CONCERNS.md HIGH).

**Amit MOST NEM építünk:** push/pull, konfliktus-merge UI, auth-flow, vektoróra/CRDT, real-time csatorna. Ezek a sync-mérföldkő tárgyai — az architektúra csak *fogadóképes* rájuk.

## Hogyan legyen az LLM opcionális/kikapcsolható (összefoglaló)

- **`LlmPort` interfész a domainban** + **`NoopLlmAdapter` alapértelmezett** (Null Object): a mag sosem tud arról, hogy van-e valódi LLM.
- **Feature flag a composition rootban** (`app/container.ts`) dönt Noop vs Live között — a UI és a domain változatlan.
- **A determinista pipeline mindig teljes kimenetet ad**; az LLM csak dúsít (`enrichSpec` = identitás Noop-nál). Ez architekturális invariáns, nem UI-kapcsoló.
- **Provider-függetlenség:** az OpenAI/helyi modell/stb. adapter-szintű részlet; a port ugyanaz marad.

---

## Scaling Considerations

| Skála | Architektúra-igazítás |
|-------|------------------------|
| 1 felhasználó (mai MVP, most) | IndexedDB single source of truth, NoopSync. Semmi hálózat. Ez a jelen mérföldkő cél-állapota. |
| 2–5 felhasználó (jövőbeli sync-mérföldkő) | LiveSyncAdapter push/pull; rekord-szintű LWW (`updatedAt`+`revision`) elég; egyszerű backend (a mai `future_scaling.md` PostgreSQL iránya). Nincs szükség CRDT-re. |
| 5+ / konkurens szerkesztés | Csak ha valós igény: mező-szintű merge vagy CRDT (pl. Yjs/Automerge) — az envelope `clock` mezővel bővíthető a mag érintése nélkül. **Nem cél**, a PROJECT.md szerint zárt kör max 5 fő. |

### Skálázási prioritások (mi törik el először)

1. **Első „szűk keresztmetszet" itt nem a teljesítmény, hanem az adatmodell:** ha az envelope/verziózás hiányzik, a sync bevezetése adat-migrációt kényszerít. → Ezért az 1. build-lépés.
2. **Export-teljesítmény és bundle-méret:** a MVP `pdfmake`+`jspdf` kettős, nem-cache-elt betöltése (CONCERNS.md MEDIUM) — a web-verzióban egyetlen, cache-elt PDF-generátor és lazy-load.
3. **God-component állapot:** a mai `App.tsx` 12+ state-je (CONCERNS.md MEDIUM) — a `hooks/` szeletekre bontás (useProjectList/useSurveyState/useExport) a UI skálázhatóságáért.

---

## Anti-Patterns

### Anti-Pattern 1: IO a domain magban (Dexie/fetch/`@tauri-apps` import a domainban)

**Amit tesznek:** a felmérés-motor vagy a scoring közvetlenül hívja az IndexedDB-t vagy a hálózatot.
**Miért rossz:** a mag tesztelhetetlenné és backend-függővé válik; a sync/LLM becsatolása a magot érinti — pont ezt akarjuk elkerülni.
**Helyette:** minden IO a portokon át; a domain csak interfészt lát. A `domain/` mappa build-szabálya: nincs `import` adapterből/infrastruktúrából.

### Anti-Pattern 2: LLM mint kötelező függőség

**Amit tesznek:** a spec-generálás közvetlenül LLM-hívást feltételez; LLM nélkül nincs (vagy hibás) kimenet.
**Miért rossz:** sérti a PROJECT.md kemény korlátját („AI nélkül is teljes értékű"); offline/kikapcsolt módban törik.
**Helyette:** determinista pipeline + `NoopLlmAdapter`; az LLM csak dúsít. Az `enrichSpec` Noop-ja identitásfüggvény.

### Anti-Pattern 3: Séma-verzió és envelope utólagos bevezetése

**Amit tesznek:** „majd a sync-mérföldkőben hozzáadjuk a verziózást."
**Miért rossz:** addigra valós adat halmozódik verzió-diszkriminátor és stabil kulcs nélkül (a mai MVP állapota, CONCERNS.md HIGH) — a migráció visszamenőleg fájdalmas és kockázatos.
**Helyette:** `schemaVersion: 1` + UUID + migrációs keret az első web-verziótól.

### Anti-Pattern 4: Fizikai törlés soft-delete helyett

**Amit tesznek:** a rekord DELETE-tel eltűnik.
**Miért rossz:** a jövőbeli sync nem tudja terjeszteni a törlést; a törölt rekord „feltámad" egy másik klienzről; nincs recovery (CONCERNS.md LOW).
**Helyette:** `deletedAt` tombstone a StoragePorton; a fizikai purge külön, kontrollált művelet (később, a sync után).

### Anti-Pattern 5: Coaching-tartalom kódba égetése

**Amit tesznek:** a „miért/mit/hogyan/etikett" szövegek `if/switch`-ekben a komponensekben.
**Miért rossz:** minden tartalombővítés/lokalizáció kódmódosítás; a motor tartalomfüggővé válik. (Rokona a CONCERNS.md „Hungarian string literals in business logic" pontjának.)
**Helyette:** verziózott tartalom-katalógus adatként (`content/coaching/`), `questionId`-re kulcsolva, ContentPorton át olvasva.

---

## Integration Points

### External Services

| Szolgáltatás | Integrációs minta | Megjegyzés |
|--------------|-------------------|------------|
| LLM provider (opcionális) | `LlmPort` + `LiveLlmAdapter`, feature flag a composition rootban | Provider-agnosztikus; Noop az alap; sosem kötelező. Adat-adatvédelem: a kikapcsolható LLM azt is jelenti, hogy alapból semmi nem hagyja el a klienst. |
| Sync backend (jövőbeli mérföldkő) | `SyncPort` + `LiveSyncAdapter` (HTTP), delta push/pull az outboxból | MOST Noop. A `future_scaling.md` PostgreSQL/Azure iránya ezzel kompatibilis. |
| Fájlrendszer (export/backup) | Böngésző letöltés + File System Access API | Kliensoldali; nincs szerver. Backup = teljes JSON dump a StoragePortról. |

### Internal Boundaries

| Határ | Kommunikáció | Megjegyzés |
|-------|--------------|------------|
| UI ↔ Domain | React hooks → pure domain függvények; reaktív lekérdezés vissza | A UI nem hív adaptert közvetlenül, csak a magon/hookokon át. |
| Domain ↔ Adapterek | Portok (interfészek), dependency inversion | Minden nyíl befelé; az adapter függ a porttól. |
| Composition root ↔ minden | `app/container.ts` köti a portokat adapterekhez + flag-ek | Egyetlen hely, ahol Noop/Live eldől (LLM, sync). |
| Content ↔ Survey engine | ContentPort (olvasás-only) | A coaching nem ír a felmérés-állapotba; laza csatolás. |

---

## Sources

- [Local-first web application architecture — plainvanillaweb.com](https://plainvanillaweb.com/blog/articles/2025-07-16-local-first-architecture/) — MEDIUM: local store mint source of truth, hálózat mint sync-csatorna.
- [Local-First Web Architecture: Syncing IndexedDB with Postgres — techbasics.online](https://www.techbasics.online/local-first-web-architecture-indexeddb-postgres-sync) — MEDIUM: sync queue, schema-version a sync-protokollban.
- [Offline-first frontend apps in 2025: IndexedDB and SQLite — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — MEDIUM: offline-first komponensek, service worker + IndexedDB + merge.
- [How We Designed Offline Sync for Any Data Model — Medium](https://medium.com/@msujithr/how-we-designed-offline-sync-for-any-data-model-0079bd4bea2f) — MEDIUM: tombstone, UUID, dirty flag, delta sync.
- [Beyond Offline-First: Data Synchronization & CRDTs — Medium](https://medium.com/@engin.bolat/beyond-offline-first-the-nightmare-of-data-synchronization-crdts-c69501a96c8d) — MEDIUM: LWW korlátai, vektoróra vs timestamp, mikor kell CRDT.
- [Implementing the Outbox Pattern — Milan Jovanović](https://milanjovanovic.tech/blog/implementing-the-outbox-pattern) — MEDIUM: outbox/change-log atomi írás + későbbi publikálás.
- [Dexie.js — hivatalos dokumentáció (versioning & upgrade)](https://dexie.org/docs/Version/Version.upgrade%28%29) — HIGH (context7 `/websites/dexie`): `version().stores().upgrade()` migrációs lánc, verziónkénti tiszta upgrade-függvény.
- [RxDB — local-first database, migrationStrategies](https://rxdb.info/) — MEDIUM: verziónkénti migrációs stratégiák, több storage backend, plugin-rendszer.
- [Hexagonal Microservice Architecture with an LLM Service — Medium (Nitish Kumar)](https://knitish91.medium.com/hexagonal-microservice-architecture-with-an-llm-service-for-credit-engine-cc8e6d21493e) — MEDIUM: LLM mint plug-and-play adapter porton át, modell-csere a mag érintése nélkül.
- [Hexagonal architecture pattern — AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) — HIGH: ports & adapters, dependency rule (nyilak befelé).
- Belső források: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` (meglévő ProjectRepository/StorageAdapter port), `.planning/codebase/CONCERNS.md` (séma-verziózás/backup/God-component hiányosságok).

---
*Architecture research for: local-first, sync-ready PM/PO felmérő web/PWA*
*Researched: 2026-07-08*
