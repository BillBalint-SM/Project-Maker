# Stack Research

**Domain:** PM/PO ügyfél-interjú felmérő és követelmény-elicitációs (requirements discovery) web/PWA eszköz — dev-ready Markdown/PDF/Excel outputtal, opcionális LLM-coachinggal
**Researched:** 2026-07-08
**Confidence:** HIGH (a perzisztencia, PDF, PWA, i18n, UI választásokra); MEDIUM (Zustand / React Router pontos patch-verzió, LLM-minta jövőbeli backendtől függ)

> **Kontextus.** Ez re-platforming: a meglévő Tauri 2 + Rust/SQLite asztali MVP-t webre/PWA-ra visszük. A stack teljesen nyitott — a Tauri/Rust réteget **elhagyjuk**, a React + TypeScript frontend-tapasztalat viszont megőrizhető és újrahasznosítható. A `codebase/CONCERNS.md` több figyelmeztetése (séma-verziózás hiánya, nincs backup, kikapcsolt CSP, típus nélküli JSON-blob, két PDF-könyvtár, God-component `App.tsx`, nincs CI) az alábbi választásokat közvetlenül vezérli — minden érintett pontnál jelölöm.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript** | 5.9.x (`strict: true`) | Teljes frontend nyelv | A meglévő MVP is TS; a `strict` mód + Zod-validáció együtt kezeli a jelenlegi „típus nélküli `as Project` cast" kockázatot (CONCERNS: untyped IPC). |
| **React** | 19.2.x | UI réteg | Az MVP React-tapasztalat átvihető. React 19 stabil, a Mantine 9 és a modern ökoszisztéma ezt várja el. Nagy közösség, hosszú távú karbantartás. |
| **Vite** | 8.1.x + `@vitejs/plugin-react` 6.x | Build + dev szerver | Az MVP is Vite-ot használ. A Vite 8 Rolldown (Rust) bundlerrel jön, 10–30× gyorsabb build; a `vite-plugin-pwa` natívan illeszkedik. |
| **Mantine** | 9.4.x (`@mantine/core`, `@mantine/hooks`) | UI komponens- és design-rendszer | 120+ kész, akadálymentes komponens (form, dátumválasztó, notification, modal, spotlight, table). Beépített dark mode, CSS-modules alapú theming — **nincs szükség külön Tailwind + fejből-épített komponensekre**. Kiváló DX, TS-first. React 19.2+ követelmény → egybevág a fenti választással. |
| **RxDB** | 17.3.x + `getRxStorageDexie()` (ingyenes storage) | Kliensoldali, local-first perzisztencia | **Ez a mérföldkő kulcsdöntése — lásd a kiemelt indoklást lentebb.** Beépített séma-verziózás + migráció, backend-agnosztikus replikációs protokoll, reaktív lekérdezések, backup plugin. Pontosan a „local-first most, sync később" útra tervezték. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **rxjs** | 7.8.x | RxDB peer-dependency (reaktív lekérdezések) | Kötelező az RxDB mellé; a reaktív `.$` observable-öket a React-be `useObservable`/`useEffect`-tel kötjük. |
| **Zod** | 4.4.x | Runtime séma-validáció + TS-típusinferencia | Interjú-válaszok / projekt-DTO validációja mentés előtt (CONCERNS: „nincs input-validáció", „típus nélküli blob"). Az `@hookform/resolvers`-en át a formokhoz is. |
| **React Hook Form** | 7.80.x + `@hookform/resolvers` 5.4.x | Interjú-/intake-form kezelés | A felmérési (checklist + interjú) űrlapok teljesítmény-barát, kevés re-renderrel járó kezelése; Zod-resolverrel típusbiztos. |
| **Zustand** | 5.x | Könnyű UI-állapot (nem-perzisztens) | A jelenlegi God-component `App.tsx` (CONCERNS) szétbontása: navigáció, kiválasztott projekt, UI-flag-ek. A **domain-adatot az RxDB reaktív lekérdezései** adják, nem a Zustand — így elkerüljük a kézi „refreshLists" mintát. |
| **React Router** | 7.x | Nézet-routing (PWA deep-link, vissza-gomb) | Web/PWA-ban a routing kötelező (az MVP asztali app-ban nem volt). Playbook-lépések, projekt-nézetek, export-nézet URL-ezhetők. |
| **vite-plugin-pwa** | 1.x (Workbox `^7.4.1`) | Telepíthető PWA + offline app-shell | Zero-config service worker, precache app-shell, `registerType: 'prompt'` frissítés-UX. A rugalmas offline-célhoz elég; nem kell kézi SW. |
| **@react-pdf/renderer** | 4.5.1 | Kliensoldali PDF, **dinamikus tördeléssel** | Deklaratív, flexbox-alapú layout-motor: a szövegdoboz a tartalomhoz nő, automatikus oldaltörés (`wrap`, `break`, fix fej-/lábléc). **Kiváltja a jelenlegi jsPDF + pdfmake párost** (CONCERNS: két PDF-lib, kézi x/y koordináták). |
| **ExcelJS** | 4.4.0 | Kliensoldali `.xlsx` stílussal | Cellastílus, dinamikus oszlopszélesség, sortörés (`wrapText`), fejléc-formázás — a „dinamikus tördelés" Excel-oldali megfelelője. Kiváltja a jelenlegi kézzel-írt XML + `fflate` megoldást. **Karbantartási figyelmeztetés lentebb.** |
| **react-markdown** | 10.1.0 + `remark-gfm` 4.0.1 | Markdown **előnézet** renderelése az UI-ban | A generált spec-csomag élő előnézete (táblázat, task-list, strikethrough GFM-mel). |
| **i18next** | 26.3.x + `react-i18next` 17.0.x | i18n (magyar alapértelmezett) | Magyar UI first-class, de i18n-képes architektúra. Kiváltja a jelenlegi kódba égetett magyar string-literálokat (CONCERNS: „hardcoded HU stringek üzleti logikában"). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Csomagkezelő | Az MVP is pnpm-et használ — megtartható. `packageManager` mező + `.nvmrc`/`.node-version` pinnelése (CONCERNS: nincs Node-verzió pinnelve). |
| **Biome** | 2.x | Lint + format egyben | Kiváltja a jelenleg **hiányzó** ESLint/Prettier-t (CONCERNS). Egy eszköz, gyors (Rust), zero-config alap. |
| **Vitest** 4.x + **@testing-library/react** 16.x | Unit/komponens teszt | Az MVP-ből átvihető konfiguráció; a Rust-tesztek elesnek, helyükre komponens- és perzisztencia-tesztek jönnek. |
| **Playwright** | 1.x | E2E + PWA offline-smoke | A felmérési flow és az export end-to-end tesztelése böngészőben; offline-mód szimuláció. |
| **GitHub Actions** | — | CI gate | Kiváltja a **hiányzó CI-t** (CONCERNS). `pnpm typecheck && test && build` minden push/PR-nél. |

---

## Kiemelt döntés: miért RxDB (Dexie-storage), és nem tiszta Dexie / PouchDB?

A downstream-kérés kifejezetten a **sync-re-felkészíthetőséget** teszi a perzisztencia-választás fő szempontjává. A `future_scaling.md` Azure / **PostgreSQL** / Entra ID jövőképet vázol, és a mostani kör elvárja a **séma-verziózást + backup/restore-t**. Ezt három jelölt ellen mértem:

**RxDB 17 + Dexie storage — AJÁNLOTT.**
- **Backend-agnosztikus replikáció.** A `replicateRxCollection` egy általános pull/push + checkpoint protokoll: tetszőleges HTTP/GraphQL/Supabase/PostgreSQL-backendhez írható replikációs handler. Ez pontosan a jövőbeli Azure/PostgreSQL-irányhoz illik — **nem köt egy konkrét sync-termékhez**. (Forrás: RxDB replication docs, Context7.)
- **Séma-verziózás + migráció first-class.** A kollekció-séma `version` mezője + `migrationStrategies` közvetlenül megoldja a CONCERNS HIGH pontját („nincs séma-verziózás → blokkolja a migrációt"). A verzió a dokumentumban él, a migráció determinisztikus.
- **Backup plugin + JSON export/import** → megoldja a CONCERNS HIGH „nincs data-backup" pontját már most.
- **Reaktív lekérdezések** (RxJS observable) → megszünteti a God-component + kézi „refreshLists" mintát; az UI a DB-változásra automatikusan frissül.
- **Ingyenes, Apache-2.0 mag.** A Dexie-storage adapter ingyenes és bőven elég ≤5 felhasználóhoz. A gyorsabb „premium IndexedDB storage" fizetős, de **nem szükséges** ilyen adatvolumennél — a Dexie-storage később egy sorral cserélhető, ha kell.
- **Sync-ready owner-mező.** A sémába most betehető egy `owner`/`userId` mező (stub `"local"` értékkel) → megoldja a CONCERNS „nincs UserContext stub az Entra ID-hez" pontját, migráció nélkül.

**Dexie 4.4 önmagában (+ dexie-cloud-addon) — ALTERNATÍVA, nem elsődleges.**
- Egyszerűbb, kisebb bundle, kiváló `liveQuery` reaktivitás és érett `version().stores()` migráció.
- **De:** a kulcsrakész sync (`dexie-cloud-addon`) a **Dexie Cloud termékhez** köt (hosztolt/self-hosztolt szerver). A régi custom-backend út (`dexie-syncable`/`dexie-observable`) **deprecated és nem kompatibilis** a Dexie Clouddal. Egy jövőbeli **saját PostgreSQL/Azure** backendhez a sync-et kézzel kellene újraírni.
- **Mikor válaszd mégis:** ha a csapat elfogadja a Dexie Cloudot mint sync-backendet (turnkey auth + hozzáférés-vezérlés kis csapatra), és nem ragaszkodik saját PostgreSQL-hez. Akkor a Dexie a legrövidebb út a syncig.

**PouchDB — KERÜLENDŐ.** CouchDB-replikációs modellhez köt (a jövőkép PostgreSQL, nem CouchDB), nagy bundle, lassuló karbantartás, `revs`/tombstone-kezelés bonyolítja a migrációt. Nincs előnye a fenti kettővel szemben ebben a domainben.

> **Összegzés:** RxDB, mert a „most local-first, később saját backendre sync" út **egyetlen könyvtárban**, backend-agnosztikusan megoldott, és egyszerre teljesíti a séma-verziózás + backup CONCERNS-elvárásokat. A tiszta Dexie akkor jobb, ha vállaljuk a Dexie Cloud terméket sync-backendként.

---

## Kiemelt döntés: PDF dinamikus tördeléshez

A követelmény: **a szövegdoboz a tartalom mennyiségéhez igazodik**, több oldalon átfolyó tartalommal.

- **@react-pdf/renderer 4.5.1 — AJÁNLOTT.** Deklaratív React-komponensekből (`<Document><Page><View><Text>`) épít PDF-et egy flexbox/yoga layout-motorral. A tartalom **automatikusan tördel** oldalak közt; a `wrap` (alapból be), `break`, és `fixed` (fej-/lábléc minden oldalon) propokkal a dinamikus tördelés natív. Ez pontosan a „doboz a tartalomhoz nő" viselkedés. Egyetlen könyvtár — **kiváltja a jelenlegi jsPDF + jspdf-autotable + pdfmake hármast** (a pdfmake ma csak a fontokért van behúzva; CONCERNS LOW/MEDIUM).
- **NEM jsPDF.** Imperatív, kézi x/y koordináta-alapú — pontosan ez okozza a jelenlegi „nem alkalmazkodik a tartalomhoz" fájdalmat. Dinamikus, változó hosszúságú spec-szövegekhez rossz illeszkedés.
- **NEM pdfmake önmagában.** Deklaratív és tud automatikus tördelést, de kevésbé karbantartott, gyengébb TS-támogatás, és a React-alapú spec-előnézettel nem osztható a komponens-modell. Ha viszont **nincs React a PDF-hez** (pl. tiszta data-driven táblázat), pdfmake elfogadható alternatíva.

**Magyar ékezetek / betűtípus:** a `@react-pdf/renderer`-nél regisztrálni kell egy Unicode-fontot (`Font.register`, pl. Roboto vagy Noto Sans TTF), mert a beépített Helvetica nem fed le minden magyar glyph-et. A fontot a projekt-asszetekbe tesszük (a jelenlegi pdfmake-VFS-hack helyett).

---

## Kiemelt döntés: opcionális LLM-integráció — kliens- vs szerveroldali kulcs

A LLM **opcionális és kikapcsolható** (PROJECT: „AI nélkül is teljes értékű"), API-kulccsal.

**Mostani (backend-nélküli, local-first) fázis — AJÁNLOTT: BYO-key kliensoldalon.**
- A felhasználó a **saját** API-kulcsát adja meg; a kulcs **kliensoldalon**, az IndexedDB-ben tárolódik (RxDB kollekció vagy külön beállítás-store), lehetőleg Web Crypto API-val titkosítva, és **soha nem kerül a repóba/buildbe**.
- Hívás: közvetlen `fetch` a szolgáltató API-jára, VAGY a **Vercel AI SDK** (`ai` csomag) provider-absztrakcióval (könnyű providerváltás: OpenAI/Anthropic/stb., streaming támogatás).
- **Kockázat/korlát (őszintén):** böngészőből hívott third-party API kulcs a felhasználó gépén él, és CORS/kulcs-expozíciós megfontolásokkal jár. ≤5 fős zárt körben, saját kulccsal ez **elfogadható** — de a UI-ban egyértelmű figyelmeztetés kell, és a kulcs soha ne szinkronizálódjon.

**Jövőbeli (sync-backend érkezésekor) — szerveroldali proxy.**
- Amikor megjön az Azure/PostgreSQL backend + Entra ID, a helyes minta a **szerveroldali kulcs**: a kliens a saját backendet hívja, az proxyzza az LLM-et (a kulcs sosem hagyja el a szervert). Az AI SDK ugyanaz maradhat, csak az endpoint változik.
- Az architektúrát erre készítsük fel: az LLM-hívás egy **absztrakt `AiProvider` interfész** mögött legyen (mint az RxaDB storage adapter), hogy a kliens→szerver váltás lokalizált maradjon.

**Determinisztikus alap.** Az AI kikapcsolt állapotában a coaching + spec-generálás **sablon-alapú** (Markdown-template + szabályok) — az AI csak dúsítja (válaszminőség-értékelés, utókérdés), nem előfeltétel.

---

## Markdown-kezelés (output + előnézet)

- **Output generálás:** a dev-ready spec-csomag **strukturált Markdown**. Ezt legmegbízhatóbban **determinisztikus string-/template-építéssel** (vagy `mdast` + `remark-stringify`-jal, ha programozott AST-manipuláció kell) állítjuk elő — nem LLM-függő. Így az output stabil, diffelhető, tesztelhető.
- **Előnézet renderelés:** `react-markdown` 10.1 + `remark-gfm` 4.0.1 az élő preview-hoz (táblázatok, task-listák, acceptance-criteria checkboxok).
- **Sanitizálás:** ha user-adat kerül a Markdownba és HTML-ként renderelődik, `rehype-sanitize` kötelező (XSS — kapcsolódik a CSP-hez lentebb).

---

## Installation

```bash
# Core
pnpm add react@19 react-dom@19 @mantine/core@9 @mantine/hooks@9

# Perzisztencia (local-first + sync-ready)
pnpm add rxdb@17 rxjs@7

# Validáció, form, állapot, routing
pnpm add zod@4 react-hook-form@7 @hookform/resolvers@5 zustand@5 react-router@7

# Export
pnpm add @react-pdf/renderer@4 exceljs@4

# Markdown (előnézet) + i18n
pnpm add react-markdown@10 remark-gfm@4 rehype-sanitize i18next@26 react-i18next@17

# Opcionális LLM (provider-absztrakció, streaming)
pnpm add ai

# Dev
pnpm add -D vite@8 @vitejs/plugin-react@6 vite-plugin-pwa@1 \
  typescript@5 vitest@4 @testing-library/react@16 @testing-library/user-event@14 \
  jsdom @playwright/test @biomejs/biome
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **RxDB (Dexie storage)** | Tiszta **Dexie 4.4 + dexie-cloud-addon** | Ha elfogadjuk a Dexie Cloudot sync-backendként (turnkey, kis csapat) és nem ragaszkodunk saját PostgreSQL/Azure backendhez. Kisebb bundle, egyszerűbb. |
| **RxDB (Dexie storage)** | **PouchDB / CouchDB** | Csak ha a backend eleve CouchDB-kompatibilis. Itt nem az → nem ajánlott. |
| **Mantine 9** | **shadcn/ui + Tailwind CSS 4** | Ha teljes design-kontroll / copy-paste komponens-tulajdon kell, és vállalunk több saját komponens-építést. Nagyobb testreszabhatóság, több kézi munka. |
| **Mantine 9** | **MUI (Material UI) 6** | Ha Material Design a márka-elvárás. Nehezebb, kevésbé „semleges" arculat. |
| **@react-pdf/renderer** | **pdfmake 0.2** | Ha nincs React a PDF-oldalon és tiszta data-driven táblázat kell; automatikus tördelés megvan, de gyengébb TS/DX. |
| **ExcelJS** | **excel4node / write-excel-file** | Ha az ExcelJS lassú karbantartása blokkoló → aktívabban karbantartott, stílust támogató alternatívák. |
| **Zustand + RxDB reaktív** | **TanStack Query** | Ha *távoli* szerver-adat cache-elés lesz a fő minta (a sync-fázisban válhat relevánssá); local-first mellett felesleges. |
| **BYO-key kliensoldalon** | **Szerveroldali LLM-proxy** | Amint van saját backend (sync-mérföldkő) → kulcs a szerverre költözik. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Tauri 2 / Rust backend** | A cél web/PWA; a natív asztali shell megszünteti a web-hozzáférhetőséget és a jövőbeli syncet bonyolítja. A Rust-tudás nem szükséges webre. | Tiszta web-stack (Vite + React + PWA). |
| **jsPDF (imperatív)** | Kézi x/y koordináták → nem alkalmazkodik a dinamikus tartalomhoz (a jelenlegi export-fájdalom gyökere). | `@react-pdf/renderer` deklaratív, auto-tördelő layout. |
| **pdfmake csak fontokért behúzva** | ~400 KB+ felesleges bundle, két PDF-lib a supply-chainben (CONCERNS). | Egyetlen `@react-pdf/renderer` + saját regisztrált TTF font. |
| **SheetJS (`xlsx`) Community** | Íráskor csendben eldobja a stílust és a data-validationt, bloatolja a fájlt; a styling csak a fizetős Próban van. Dinamikus, formázott exporthoz alkalmatlan. | **ExcelJS** (ingyenes stílus + oszlopszélesség + wrapText). |
| **Kézzel írt xlsx-XML + fflate** (jelenlegi MVP) | Nehezen karbantartható, nincs streaming, hibalehetőség. | ExcelJS. |
| **dexie-observable / dexie-syncable** | Deprecated, nem kompatibilis a Dexie Clouddal. | RxDB replication, vagy dexie-cloud-addon. |
| **`csp: null` / CSP kikapcsolása** (jelenlegi minta) | XSS-nyitány (CONCERNS HIGH). Weben még kritikusabb, mint asztali shellben. | Szigorú CSP header (`default-src 'self'`), `rehype-sanitize` a Markdown-renderben. |
| **Kódba égetett magyar string-literálok** (jelenlegi minta) | Törékeny `===` összehasonlítások, i18n-blokkoló (CONCERNS). | i18next kulcsok + TS-const enumok a státusz/ajánlás-értékekre. |

---

## Stack Patterns by Variant

**Ha a sync-backend saját PostgreSQL/Azure lesz (a `future_scaling.md` iránya):**
- Használd az **RxDB `replicateRxCollection`** custom pull/push handlereket egy HTTP/GraphQL endpointra.
- Miért: backend-agnosztikus, nincs termék-lock-in; a checkpoint-alapú protokoll jól illik REST/GraphQL mögé.

**Ha a csapat elfogadja a turnkey sync-terméket:**
- Használd a **Dexie 4.4 + dexie-cloud-addon**-t (self-hosztolható Dexie Cloud Server 3.0).
- Miért: egy sorral bekapcsolható sync + auth + hozzáférés-vezérlés kis csapatra; nincs saját backend-fejlesztés.

**Ha a design-kontroll fontosabb a fejlesztési sebességnél:**
- Használd a **shadcn/ui + Tailwind 4**-et Mantine helyett.
- Miért: teljes komponens-tulajdon és arculati szabadság, cserébe több kézi munka.

**Ha az AI-t bekapcsolják:**
- Használd a **Vercel AI SDK (`ai`)** provider-absztrakciót egy `AiProvider` interfész mögött, BYO-key kliensoldalon (most) → szerver-proxy (sync-fázisban).
- Miért: providerváltás és a kliens→szerver kulcs-migráció lokalizált marad.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@mantine/core@9.4` | `react@19.2+` | **Mantine 9 megköveteli a React 19.2+-t.** React 18-ra Mantine 8-at kell használni — de mi 19-re megyünk. |
| `rxdb@17.3` | `rxjs@7.8` | Az `rxjs` kötelező peer-dependency. Storage import v14 óta prefixelt: `rxdb/plugins/storage-dexie`. |
| `vite-plugin-pwa@1.x` | `vite@3.1 – 8.0`, `workbox@7.4` | Vite 8-cal kompatibilis (a plugin ^8.0.0-ig deklarál). |
| `@vitejs/plugin-react@6` | `vite@8` | v6 Oxc-t használ Babel helyett a React Refreshhez. |
| `react-hook-form@7.80` | `@hookform/resolvers@5.4` + `zod@4.4` | A resolver 5.x a Zod 4-hez igazodik. |
| `react-markdown@10.1` | `remark-gfm@4.0.1` | Uniform/remark ökoszisztéma, ESM-only. |

**Karbantartási figyelmeztetések (őszintén):**
- **ExcelJS 4.4.0** legutóbbi kiadása kb. 3 éve — funkcionálisan stabil és széles körben használt (~1.9M heti letöltés), de **lassuló karbantartás**. Rögzítsd pontos verzióra (`exceljs@4.4.0`, `^` nélkül), és tartsd szemmel; ha blokkoló hiba jön, a `write-excel-file`/`excel4node` a menekülőút.
- **react-markdown 10 / remark-gfm 4** ESM-only — Vite alatt nem gond, de SSR/Jest-környezetben konfigurációt igényelhet (mi Vitest-et használunk, rendben).
- A `codebase/CONCERNS.md` a jsPDF v4/autotable v5 instabilitását jelölte — a `@react-pdf/renderer`-re váltással ez a kockázat **megszűnik**.

---

## CONCERNS.md → megoldás megfeleltetés

| CONCERNS (jelenlegi kockázat) | Súly | Stack-válasz |
|---|---|---|
| Nincs séma-verziózás (blokkolja a migrációt) | HIGH | RxDB séma `version` + `migrationStrategies` |
| Nincs data-backup | HIGH | RxDB backup plugin + JSON export/import |
| CSP kikapcsolva | HIGH | Szigorú CSP header + `rehype-sanitize` |
| Nincs UserContext stub (Entra ID) | HIGH | RxDB sémába `owner`/`userId` mező most (`"local"` stub) |
| Típus nélküli JSON-blob (`as Project`) | MEDIUM | Zod-validáció mentés előtt + RxDB JSON-schema |
| Két PDF-könyvtár, kézi layout | LOW/MED | Egyetlen `@react-pdf/renderer` |
| God-component `App.tsx`, kézi refresh | MEDIUM | RxDB reaktív lekérdezések + Zustand UI-store |
| Nincs input-validáció | MEDIUM | Zod + React Hook Form resolver |
| Kódba égetett HU stringek | LOW | i18next kulcsok + TS-const enumok |
| Nincs CI / lint / format | MEDIUM | GitHub Actions + Biome |
| Kézzel írt xlsx-XML | LOW | ExcelJS |

---

## Sources

- **Context7** `/pubkey/rxdb` — replikációs protokoll (`replicateRxCollection`), Dexie storage adapter, séma-migráció, free vs premium licenc (Apache-2.0 mag ingyenes; premium IndexedDB storage opcionális). HIGH.
- **Context7** `/dexie/dexie.js`, `/diegomura/react-pdf` — könyvtár-azonosítás/dokumentáció. HIGH.
- [rxdb npm](https://www.npmjs.com/package/rxdb) — 17.3.0 (verzió ellenőrizve). HIGH.
- [dexie npm](https://www.npmjs.com/package/dexie) + [Dexie 4.4 & Dexie Cloud Server 3.0 blog](https://medium.com/dexie-js/dexie-4-4-dexie-cloud-server-3-0-the-big-one-d883b98599e8) — 4.4.4; dexie-syncable deprecated. HIGH.
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — 4.5.1. HIGH.
- [Mantine changelog v9](https://mantine.dev/changelog/9-0-0/) + [@mantine/core npm](https://www.npmjs.com/package/@mantine/core) — 9.4.1, React 19.2+ követelmény. HIGH.
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + [GitHub](https://github.com/vite-pwa/vite-plugin-pwa) — Workbox 7.4.1, Vite ≤8 támogatás. HIGH.
- [exceljs npm](https://www.npmjs.com/package/exceljs) + [SheetJS vs ExcelJS 2026 guide](https://www.pkgpulse.com/guides/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026) — 4.4.0; SheetJS Community stílus-korlátok. HIGH.
- [i18next npm](https://www.npmjs.com/package/i18next) + [react-i18next](https://github.com/i18next/react-i18next) — 26.3.5 / 17.0.8. HIGH.
- [react-markdown npm](https://www.npmjs.com/package/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) — 10.1.0 / 4.0.1. HIGH.
- [Vite 8 release](https://vite.dev/blog/announcing-vite8) + [React versions](https://react.dev/versions) — Vite 8.1.3 / React 19.2.7. HIGH.
- [React Hook Form + Zod 2026 guide](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1) — RHF 7.80, Zod 4.4.3, resolvers 5.4. HIGH (RHF/Zod); Zustand 5.x / React Router 7.x pontos patch nem npm-ellenőrzött → MEDIUM.

---
*Stack research for: PM/PO web/PWA követelmény-elicitációs eszköz (local-first, sync-ready)*
*Researched: 2026-07-08*
