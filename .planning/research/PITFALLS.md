# Pitfalls Research

**Domain:** Local-first + sync-re-készülő, offline-képes, kliensoldali export-heavy, opcionális-AI PM/PO felmérő web/PWA
**Researched:** 2026-07-08
**Confidence:** HIGH (adatmodell/sync, PWA-cache, LLM-kulcs); MEDIUM (kliensoldali PDF/Excel skálázás, migráció)

> Ez a dokumentum a **re-platforming** (desktop Tauri → web/PWA) buktatóira fókuszál, kiemelt figyelemmel arra, hogy **milyen adatmodell-döntéseket kell MOST jól meghozni**, hogy a későbbi, max 5 fős sync ne legyen fájdalmas. A jelenlegi MVP-ben már azonosított kockázatok (lásd `CONCERNS.md`) beépítve.

---

## Critical Pitfalls

### Pitfall 1: Nincs stabil, globálisan egyedi azonosító — auto-increment / lokális ID-k

**What goes wrong:**
Az entitások (projekt, kérdés-válasz, checklist-tétel, spec-blokk) auto-increment integer vagy csak lokálisan egyedi ID-t kapnak. Amint két eszköz offline hoz létre rekordot, a sync-nél ütköznek az ID-k (mindkettő „projekt #7"), és nincs determinisztikus feloldás. A relációk (válasz → projekt) is eltörnek, mert a hivatkozott ID mást jelent a másik eszközön.

**Why it happens:**
Az egyfelhasználós MVP-ben az auto-increment kényelmes és „elég". A sync igénye a jövőbeli mérföldkőre van halasztva, így az ID-döntés triviálisnak tűnik — pedig ez a *legdrágábban* visszamenőleg javítható döntés, mert minden rekord és minden reláció érintett.

**How to avoid:**
- **MOST** vezess be kliensoldalon generált, ütközésmentes azonosítót: **ULID** (időrendezhető, ajánlott) vagy UUIDv7. Minden entitás elsődleges kulcsa string ID legyen, ne integer.
- A relácik *kizárólag* ezekre a stabil ID-kra hivatkozzanak (foreign key mezők), soha sortszámra vagy tömbindexre.
- Vezess be egy **`device_id` / `actor_id`** mezőt is (per telepítés generált stabil azonosító) — ez a későbbi konfliktusfeloldás és „ki írta" naplózás alapja.
- A jelenlegi MVP JSON-blob modelljében (`storageAdapters.ts`) a projekt már objektum — adj neki `id: ULID`, és a beágyazott tömböknek (válaszok, tételek) is stabil ID-t.

**Warning signs:**
Bárhol `index`, `arr.length`, `Date.now()`-ból képzett kulcs, vagy `max(id)+1` mintát látsz azonosítóként. React `key={index}` a listákban szintén tünet (bár az csak render-szintű).

**Phase to address:**
**Adatmodell / perzisztencia alapozó fázis (early, blocking).** Ez a fázis fejezze be, mielőtt bármelyik feature-fázis rekordokat kezd írni.

---

### Pitfall 2: Törlés = fizikai DELETE (tombstone hiánya)

**What goes wrong:**
Egy rekord törlésekor a sor eltűnik az adatbázisból. Sync-nél az eszköz, amelyik nem látta a törlést, „új" rekordként visszaküldi — a törölt adat **feltámad** (zombie record). Klasszikus local-first bug.

**Why it happens:**
A hard delete a legegyszerűbb, és egyfelhasználós, egyeszközös MVP-ben helyes is. A sync-szemantika (a törlésnek is „állapotnak" kell lennie, amit szinkronizálni lehet) nem intuitív előre.

**How to avoid:**
- Vezess be **soft delete / tombstone** mintát MOST: `deleted_at` timestamp (vagy `is_deleted` + `deleted_at`) minden szinkronizálandó entitáson. A törlés = mező beállítása, nem sor eltávolítása.
- A lekérdezések alapból szűrjenek `deleted_at IS NULL`-ra.
- Tombstone-purge (végleges takarítás) csak **jóval a sync-horizonton túl** történjen, vagy sosem — 5 fős, kis adatmennyiségnél a tombstone-ok megtartása olcsó, és megelőzi a feltámadást.
- Figyelj: a `CONCERNS.md` jelzi, hogy az archív-törlés ma végleges (`window.confirm` → hard delete). Ezt cseréld soft delete-re — egyben az „nincs undo" problémát is enyhíti.

**Warning signs:**
`DELETE FROM`, `array.filter(x => x.id !== id)` mentés előtt, vagy bármi, ami a rekordot ténylegesen eltávolítja a perzisztens tárolóból.

**Phase to address:**
**Adatmodell / perzisztencia alapozó fázis.**

---

### Pitfall 3: Nincs per-mező változáskövetés / verziózás — csak „az egész objektum" mentődik

**What goes wrong:**
A teljes projekt egyetlen JSON-blobként mentődik (ahogy a mai MVP is: `JSON.stringify(project)`). Sync-nél nincs mód mezőszintű összefésülésre: ha A eszköz a határidőt, B eszköz a kontaktot módosította ugyanazon a projekten offline, a naiv „last-write-wins az egész blobra" **elveszíti az egyik módosítást** teljesen.

**Why it happens:**
A blob-tárolás gyors és sémamentes — vonzó MVP-ben. A mezőszintű konfliktus csak sync közben jelentkezik, addig láthatatlan.

**How to avoid:**
- Döntsd el a **konfliktus-granularitást MOST**, akkor is, ha a sync később jön. 5 fős, dokumentum-orientált eszköznél a teljes CRDT (pl. Yjs/Automerge) **valószínűleg túlzás** és túlméretezés (lásd Pitfall 12) — de a naiv blob-LWW **kevés**.
- **Ajánlott arany középút:** *mezőszintű last-write-wins per-mező timestamppel*. Azaz minden szinkronizálandó mezőhöz (vagy logikai mezőcsoporthoz) tartozzon egy `updated_at` (és ideálisan `updated_by = actor_id`). Sync-nél mezőnként a nagyobb timestamp nyer. Ez elkerüli a „B felülírja A egészét" bugot, CRDT-komplexitás nélkül.
- Ehhez a modellt **normalizáltabbra** kell bontani, mint a mai egy-blob: legalább entitás-szintre (projekt, válasz-tétel), ideálisan a gyakran külön szerkesztett mezőket külön követve.
- Vezess be **rekord-szintű `version` (monoton counter)** mezőt is az optimista konkurenciához / debughoz.
- Free-text hosszú válaszmezőknél (interjú-jegyzet) mérlegeld, hogy szöveges összefésülés kell-e — ha igen, ez az *egyetlen* hely, ahol egy szűk CRDT (pl. per-mező text CRDT) indokolt lehet; egyébként LWW + „konfliktus megjelölése a usernek".

**Warning signs:**
Egyetlen `data` oszlop az egész projekttel; mentéskor `JSON.stringify(wholeProject)`; nincs mezőnkénti időbélyeg sehol.

**Phase to address:**
**Adatmodell / perzisztencia alapozó fázis.** A granularitás-döntés blokkolja a sync-mérföldkövet.

---

### Pitfall 4: Séma-verziózás hiánya — a migráció lehetetlenné válik

**What goes wrong:**
A perzisztált adatnak nincs `schema_version` diszkriminátora. Ahogy a modell fejlődik (mezők jönnek/mennek), a régi lokális adatok betöltése csendben hibás/hiányos objektumot ad. A jövőbeli sync/backend-migrációnak nincs mihez kötnie a transzformációt. (Ezt a `CONCERNS.md` HIGH-ként jelöli: „No schema versioning — blocks future migration".)

**Why it happens:**
MVP-ben a séma „stabilnak" tűnik, a verziómező felesleges ceremóniának hat. A költség csak akkor jelentkezik, amikor már sok élő adat van a régi formátumban.

**How to avoid:**
- Adj **`schema_version: number`** mezőt minden perzisztált gyökér-entitáshoz **MOST**, mielőtt a webes app első adatot ír.
- Írj **verzió-kulcsolt migrációs pipeline-t**: `migrate(data, fromVersion → toVersion)` lánc, amely betöltéskor felhozza a legfrissebb sémára. A mai `normalizeProject` ennek a csírája — tedd verzió-tudatossá.
- Minden séma-változtatás = verzió-emelés + migrációs lépés + teszt a régi fixtúrán.
- **IndexedDB `onupgradeneeded`**: a böngésző-oldali DB-nek külön, saját verziója van — ezt is verziózd tudatosan, ne csak a rekord-sémát (lásd Pitfall 6).

**Warning signs:**
Nincs `schema_version` a mentett adatban; a betöltő kód `as Project` cast-tal dolgozik séma-validáció nélkül (mai állapot); „majd később hozzáadjuk" a verziómezőt.

**Phase to address:**
**Adatmodell / perzisztencia alapozó fázis.** Egyben a **migráció (Pitfall 10)** előfeltétele.

---

### Pitfall 5: Nincs backup/restore és nincs runtime séma-validáció → csendes adatvesztés

**What goes wrong:**
A local-first app teljes felelőssége a felhasználónál van: nincs szerver, ami mentene. Egy böngésző cache-ürítés, „adatok törlése", inkognitó, storage-kvóta-eviction, vagy egy hibás írás **véglegesen elviszi az összes munkát**. Validáció nélkül egy korrupt rekord csendben részleges objektumot ad vissza (a `CONCERNS.md` ezt jelzi az untyped IPC / `as Project` cast kapcsán).

**Why it happens:**
Desktopon a SQLite-fájl „megvolt valahol". Böngészőben az IndexedDB/CacheStorage **eviction alá esik**, és a felhasználó egy gombnyomással törölheti. Fejlesztők a desktop-mentális modellt viszik át.

**How to avoid:**
- **Backup/restore MOST, first-class feature:** teljes JSON export („mentsd le a projektjeidet fájlba") és import. Ez egyszerre backup, migrációs eszköz és a jövőbeli sync „bootstrap" formátuma. A `CONCERNS.md` ezt HIGH-ként kéri.
- Kérj **persistent storage**-ot: `navigator.storage.persist()` — csökkenti az eviction esélyét (de nem garancia; a user így is törölhet).
- Vezess be **runtime séma-validációt** (pl. Zod) a betöltési úton — korrupt adat *látható hibát* adjon, ne csendes részleges objektumot. Ez a mai `as Project` cast közvetlen javítása.
- Automatikus, csendes lokális pillanatkép (pl. időszakos export IndexedDB külön store-ba) opció a „véletlen felülírás" ellen.

**Warning signs:**
Nincs export-nyers-adat funkció; `navigator.storage.persist()` sehol; a betöltő nem validál; a felhasználónak nincs módja „hova tűnt a projektem" helyreállításra.

**Phase to address:**
**Perzisztencia/backup fázis** (közel az adatmodell-alapozóhoz). A validáció az adatmodell-fázisba tartozik.

---

### Pitfall 6: PWA cache / service worker — a felhasználó „beragad" egy régi verzióba

**What goes wrong:**
Az agresszív precache miatt a felhasználó régi JS/HTML-t lát új deploy után („miért nem változott semmi?"), vagy fordítva: cache-verzió-bump törli az egész cache-t és mindent újratölt (lassú, offline-nál akár működésképtelen). Rosszabb: egy régi app-verzió **régi séma szerint ír** friss adat mellé → adat-inkonzisztencia.

**Why it happens:**
A service worker életciklusa (install → waiting → activate, `skipWaiting`, `clients.claim`) nem intuitív. A „töltsd újra" nem elég, mert a SW szolgálja ki a régi assetet. A cache-invalidáció köztudottan nehéz.

**How to avoid:**
- Használj **bevált SW-eszközt** (pl. Workbox) kézzel írt SW helyett — a build-hash-alapú precache-manifest megoldja az asset-verziózást.
- **Cache-stratégiák tudatosan:** hashelt statikus assetre *cache-first*; app-shell HTML-re *network-first* (hogy új verzió gyorsan érkezzen); read-only API/JSON-ra *stale-while-revalidate*.
- **Verziózott cache-nevek**, de ne „bumpolj-és-törölj-mindent" — a Workbox precache csak a *változott* fájlokat frissíti.
- **Frissítési UX:** amikor új SW `waiting` állapotba kerül, mutass a felhasználónak „Új verzió elérhető — Frissítés" gombot (kontrollált `skipWaiting` + reload), ne csendben vagy sosem.
- **Séma-kompatibilitás deploy-nál:** mivel a régi kliens is írhat még, a séma-migrációk legyenek *additívak/előre-kompatibilisek* egy átmeneti ideig (ne törölj mezőt azonnal).
- **Egy origin = megosztott CacheStorage + IndexedDB namespace** — ha később más app is ugyanarra az originre kerül, prefixeld a cache/DB neveket, hogy ne írják felül egymást.

**Warning signs:**
Kézzel írt `sw.js` string-alapú cache-listával; „töröld a cache-t és próbáld újra" a support-válasz; nincs update-prompt UI; a deploy után tesztelők vegyes verziókat látnak.

**Phase to address:**
**PWA-shell / offline fázis.** A frissítési UX a UI-fázissal is összefügg.

---

### Pitfall 7: Kliensoldali LLM-hívás beégetett vagy kliensen tárolt API-kulccsal

**What goes wrong:**
Az opcionális AI-funkcióhoz az API-kulcs a kliens-JS-be kerül (env-be buildeléskor) → **bárki kiolvassa a DevTools-ban** másodpercek alatt, és a te számládra generál költséget (dokumentált eset: órák alatt ezrekben mérhető kár). Még a „user adja meg a saját kulcsát és localStorage-ban tároljuk" is kockázatos: XSS esetén (a mai app CSP-je *ki van kapcsolva* — `CONCERNS.md` HIGH!) a kulcs kiszivárog, és plaintext localStorage bármely script számára olvasható.

**Why it happens:**
Local-first, szerver-nélküli architektúrában nincs hova tenni a kulcsot „biztonságosan". A proxy-szerver ellentmond a „nincs backend" célnak, ezért fejlesztők a kliensre teszik.

**How to avoid:**
- **SOHA ne szállíts szolgáltatói kulcsot a kliensben.** A te (fejlesztői) kulcsod semmiképp.
- **BYOK modell (a projekt AI-opcionalitásához illő):** a *felhasználó* adja meg a saját kulcsát. De:
  - Tárold **session-scope**-ban vagy explicit „emlékezz rá" opció mögött, ne alapból plaintext localStorage-ban; ha perzisztálod, figyelmeztesd a felhasználót.
  - **Kapcsold be a CSP-t** (a mai kikapcsolt CSP közvetlen blokkoló) — XSS-mentesség előfeltétel, mielőtt bármilyen titkot kliensen kezelsz.
  - Sanitizáld/korlátozd, mi megy ki: **soha ne küldj PII-t/ügyféladatot az LLM-nek a felhasználó tudta és explicit engedélye nélkül** (adatvédelem — a felmérés ügyféladatot tartalmaz!).
- **Ha van bármilyen szerver-komponens** (akár a jövőbeli sync-nél): akkor a helyes minta a **szerver-oldali proxy** rövid életű tokennel + rate-limittel — de ez architekturális döntés, ne csúsztasd be most (scope).
- **Kikapcsolhatóság = valódi kill switch:** az app AI nélkül *teljes értékű* legyen (a PROJECT.md korlát). Az AI-kód mögött legyen tiszta interfész, hogy determinisztikus (sablon) fallback mindig működjön.
- **Adatvédelmi átláthatóság:** a felhasználó lássa, *mit* és *hová* küldesz; a szolgáltatói ZDR/retention nem garantált BYOK-nál — kommunikáld.

**Warning signs:**
API-kulcs `.env`-ben `VITE_`/`NEXT_PUBLIC_` prefixszel; kulcs a bundle-ben (`grep` a dist-ben); ügyfél-válaszszöveg feltétel nélkül megy az LLM-nek; nincs „AI kikapcsolása" kapcsoló; CSP `null`.

**Phase to address:**
**AI-integrációs fázis** (az AI-SPEC contract kötelező). A **CSP-bekapcsolás előfeltétel** és a PWA/biztonsági fázisba tartozik.

---

### Pitfall 8: Kliensoldali PDF/Excel dinamikus tördeléssel — memória és layout-robbanás

**What goes wrong:**
Nagy, dinamikusan tördelt PDF/Excel generálása a böngészőben **kimeríti a memóriát** (különösen képekkel/beágyazott fontokkal), lefagy vagy hibás layoutot ad. A jsPDF-nek **nincs layout/tördelő API-ja** — x,y koordinátákat kell számolni, így a „szövegdoboz igazodjon a tartalomhoz" követelmény kézi magasságszámítást és laptörés-logikát jelent, ami tele van él-esetekkel (túlcsordulás, elárvult sorok, táblázat lapon átnyúlás). A mai kód ráadásul minden exportnál újratölti a nagy font-VFS-t (`CONCERNS.md` MEDIUM), és két PDF-libet cipel (`jspdf` + `pdfmake` csak fontért).

**Why it happens:**
A „szerver nélkül, mindent a kliensen" cél vonzó, és kis MVP-adatnál működik. A dinamikus tördelés bonyolultsága és a memóriakorlát csak nagyobb/telített dokumentumnál csap le.

**How to avoid:**
- **Válaszd a tördelést natívan támogató libet:** `pdfmake` document-definition modellje **automatikus lapozást és content-alapú dobozméretezést** ad — pont a „szövegdoboz a tartalomhoz igazodik" követelményre. Ha ezt használod, ne cipeld *mellé* a jsPDF-et is; egy libet válassz. (A mai fordított helyzet — pdfmake csak fontért, render jsPDF-fel — a legrosszabb: minden hátrány, kevés előny.)
- **Fontkezelés:** subset-eld a fontot (csak a használt glyphek, magyar ékezetekkel!), és **cache-eld modul-szinten** az első betöltés után — ne importáld újra minden exportnál.
- **Képek:** tömörítsd beágyazás előtt; kerüld a nagy felbontású képek DataURL-ként való beszúrását.
- **Nagy dokumentum stratégia:** 5 fő × sok projekt esetén is a *pillanatnyi export* jellemzően 1 projekt → kliensoldalon rendben marad. De tesztelj **worst-case fixtúrával** (maximálisan kitöltött, hosszú free-text válaszokkal), ne üres MVP-adaton. Ha lefagy: fontold meg a generálás **Web Workerbe** tolását (ne blokkolja az UI szálat), vagy legvégső esetben szerver-oldali rendert (scope-döntés).
- **Layout-hibák ellen:** determinisztikus, adatvezérelt sablon (ne ad-hoc koordináták), és vizuális regressziós ellenőrzés a tördelésre a worst-case fixtúrán.
- **Excel:** a mai kézzel-gányolt XML string-építés (`CONCERNS.md` LOW) nem streamel — nagyobb exportnál memóriaprobléma; ha nő az adat, streaming xlsx lib.

**Warning signs:**
jsPDF-fel kézi `y += lineHeight` tördelés; tab lefagy nagy exportnál; a PDF-lib import minden kattintásra fut; export csak üres/kicsi teszt-adaton próbálva; magyar ékezetek hiányoznak a PDF-ből (font-subset gond).

**Phase to address:**
**Export/dokumentumgenerálás fázis.** A stack-döntés (melyik PDF-lib) a stack-kutatásba is átnyúlik.

---

### Pitfall 9: A coaching/edukációs tartalom a kódba égetve

**What goes wrong:**
A kérdésenkénti coaching (miért fontos, mit ad technikailag, hogyan kérdezz, etikett), a tippek és a kérdés-sablonok/playbook **forráskódba** kerülnek (JSX-be, string-literálként). Minden tartalmi módosítás kódmódosítás + build + deploy; nem-fejlesztő nem tudja karbantartani; a tartalom és a logika összegabalyodik. A mai MVP már mutat ilyet: magyar string-literálok üzleti logikában, `===` összehasonlításokkal (`CONCERNS.md`).

**Why it happens:**
Kezdetben kevés tartalom van, „gyorsabb beírni". A tartalom mennyisége és változási üteme alábecsült — pedig a coaching-réteg a termék *fő értéke*, tehát sokat és gyakran fog változni.

**How to avoid:**
- **Tartalom = adat, nem kód.** Tárold strukturált, verziózott adatfájlokban (JSON/YAML/MDX), séma-validálva (Zod). A kérdés-playbook, coaching-szövegek, tippek, acceptance-criteria-sablonok mind adatrekordok, stabil ID-vel.
- Válaszd el a **tartalom sémáját** a megjelenítéstől: a komponens rendereli, amit az adat mond; új kérdés/tipp = adatbejegyzés, nem komponens.
- A státusz/döntés/érték-címkéket tedd **konstans/enum**-ba (a mai `===` string-összehasonlítás közvetlen javítása) — a magyar szöveg csak a megjelenítési réteg (i18n-kész, még ha most csak magyar is).
- A tartalom **verziózható és exportálható** legyen (a coaching anyag maga is fejlődik) — ne keveredjen a *felhasználói adat* sémaverziójával, legyen külön `content_version`.

**Warning signs:**
Coaching-szöveg JSX-ben; új kérdés hozzáadása = React-komponens írása; tartalmi tipó-javításhoz deploy kell; üzleti döntés magyar string `===`-sel.

**Phase to address:**
**Coaching/tartalom-modell fázis** (a felmérési élmény fázisával párhuzamosan vagy előtte). A tartalom-séma az adatmodell-alapozó része.

---

### Pitfall 10: A meglévő lokális MVP-adat migrációja utólag / ad-hoc módon

**What goes wrong:**
A webes app „zöldmezős"-ként indul, és a Tauri/SQLite MVP-ben lévő valós felhasználói projektek migrációja utólagos gondolat. Mivel a régi adat **verziózatlan JSON-blob** (`CONCERNS.md` HIGH: „No migration path"), és a webes séma közben megváltozott, a migráció kézi, hibás, részleges — vagy egyszerűen elmarad, és a felhasználók elveszítik a munkájukat.

**Why it happens:**
A re-platforming izgalma a *feature*-ökre fókuszál; a „régi adat" unalmasnak és kicsinek tűnik. De egy validáló MVP-nek *vannak* valós felhasználói, akiknek az adata a bizalom alapja.

**How to avoid:**
- **Definiáld a migrációs kontraktot korán:** a régi SQLite-blob → új webes séma. Ez az a hely, ahol a `schema_version` (Pitfall 4) kifizetődik — a régi adat kapjon `schema_version: 0`-t, és a migrációs lánc hozza fel.
- Építs a **JSON export/import**-ra (Pitfall 5): adj a Tauri-MVP-nek egy „exportálj mindent JSON-ba" parancsot (a `CONCERNS.md` amúgy is kéri), és a webes app importálja ezt a formátumot. Így a migráció = export a régiből + import az újba, tesztelhetően.
- **Teszteld valós/valósághű fixtúrán**, ne csak friss adaton: régi mezőnevek, hiányzó mezők, ékezetes szövegek, üres/rész-kitöltött projektek.
- A migráció legyen **idempotens és nem-destruktív** (a régi adat maradjon meg, amíg az új validált).

**Warning signs:**
Nincs terv a régi adatra; a régi adatnak nincs verziója; „majd a felhasználók újra beírják"; a migrációt csak üres/friss példányon próbálták.

**Phase to address:**
**Migrációs fázis** (az adatmodell + backup/restore fázisok *után*, de a webes GA *előtt*). Előfeltétele a `schema_version` és a JSON export/import.

---

### Pitfall 11: „Egységes újragondolás" → scope-robbanás és túlméretezett architektúra

**What goes wrong:**
Az „egységes, újragondolt felmérési élmény" + coaching + AI + sync-előkészítés + export egyszerre, „rendesen" akarása oda vezet, hogy sosem szállít semmi, vagy sync-mérföldkőre méretezett komplexitást (teljes CRDT-stack, event-sourcing, konfliktus-UI) építesz be *most*, amikor még egyfelhasználós vagy. A túl korai absztrakció ugyanolyan drága, mint a hiányzó.

**Why it happens:**
A re-platforming „tiszta lap" érzése csábít a nagy újratervezésre. A „sync-re készülünk" félreértelmezve → „építsük meg a syncet". A PROJECT.md viszont explicit: **sync most csak *előkészítés*, max 5 fő**, offline rugalmas, nem kemény.

**How to avoid:**
- **Húzd meg a vonalat élesen:** „sync-*ready* adatmodell" ≠ „sync-*implementáció*". A most kötelező: stabil ID-k, tombstone, per-mező timestamp, `schema_version`, actor_id, backup/restore. A most **tiltott**: valódi sync-transport, konfliktus-feloldó UI, auth-rendszer, CRDT-runtime (kivéve ha egy szűk text-mezőnél muszáj).
- **Max 5 fő = ne túltervezz:** nincs szükség eventual-consistency-elosztott-rendszer szintű garanciákra. A LWW-per-mező + tombstone bőven elég ehhez a skálához. Ne építs olyat, ami 10k userre méretez (a `CONCERNS.md` Azure/PostgreSQL jövőkép *jövő*, nem most).
- **Auth-stub, ne auth:** a `CONCERNS.md` javaslata jó — definiálj egy `UserContext { userId: "local" }` stubot most, hogy a jövőbeli auth ne igényeljen mindent-átszúró refaktort, de *ne építs* auth-ot.
- **Vertikális szeletek:** szállíts működő felmérés→export flow-t korán, aztán rétegezd rá a coachingot/AI-t. Minden fázis legyen önmagában értékes AI és sync nélkül is.

**Warning signs:**
CRDT-könyvtár a függőségekben egyfelhasználós fázisban; „konfliktusfeloldó képernyő" terv sync nélkül; auth-provider integráció; hónapok telnek működő végponti flow nélkül; „mielőtt ezt szállítjuk, előbb X-et is rendesen".

**Phase to address:**
**Roadmap-struktúra / fázistervezés szintjén** (nem egy konkrét fázis). Minden fázis success-criteria-jában szerepeljen: „AI és sync nélkül is teljes".

---

### Pitfall 12: Kliens-óra alapú konfliktusfeloldás megbízhatatlan timestamppel

**What goes wrong:**
A per-mező LWW a kliens `Date.now()`-jára támaszkodik. A felhasználók órái eltérnek (skew), át lehet állítani, DST/időzóna-hibák — így egy „régebbi" írás nyerhet egy újabb felett, csendes adatvesztéssel. Kis csapatnál ritka, de reprodukálhatatlan és bizalomromboló.

**Why it happens:**
A wall-clock timestamp kézenfekvő és „elég jó"-nak tűnik. A skew-probléma csak elosztott környezetben (sync) jelentkezik, addig láthatatlan.

**How to avoid:**
- Tárold a `updated_at`-ot, **de** a döntéshez adj mellé egy **logikai órát**: **Lamport-timestamp** (monoton counter) vagy hibrid logikai óra (HLC). Döntetlennél az `actor_id` a determinisztikus tie-breaker.
- Ne purge-öld a tombstone-okat óra alapján (Pitfall 2) — logikai horizonthoz kösd.
- 5 fős skálán a **HLC/Lamport bevezetése olcsó**, és pont ez a „most jól meghozandó adatmodell-döntés", ami a jövőbeli syncet fájdalommentessé teszi: a rekordokon *már ott van* a monoton counter, amikor a sync megérkezik.
- **MOST minimum:** minden szinkronizálandó íráshoz `updated_at` + monoton `version` counter + `actor_id`. A HLC-t rá lehet építeni később, ha a counter már megvan.

**Warning signs:**
Konfliktus-döntés kizárólag `Date.now()` / `new Date()` alapján; nincs monoton counter a rekordokon; időzóna-függő összehasonlítás.

**Phase to address:**
**Adatmodell / perzisztencia alapozó fázis** (a per-mező timestamp döntéssel együtt).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Egész projekt egy JSON-blobként tárolva | Gyors, sémamentes írás | Nincs mezőszintű merge → sync-nél adatvesztés; nehéz migráció | Csak ha *soha* nem lesz sync — de a PROJECT.md szerint lesz → **kerülendő most** |
| Auto-increment / lokális ID | Egyszerű | ID-ütközés sync-nél, minden reláció érintett | **Soha** (sync-célú projektben) |
| Hard delete | Egyszerű | Zombie-rekordok sync-nél | Csak nem-szinkronizált, származtatott adatnál |
| Kliens `Date.now()` konfliktushoz | Triviális | Óra-skew adatvesztés | MVP-ben ideiglenesen, ha van monoton `version` mellette |
| Coaching-szöveg kódba írva | Gyors első tartalom | Minden tartalmi változás = deploy; nem-dev nem karbantartja | Csak throwaway prototípusban |
| Kézzel írt service worker | Nincs build-tool függés | Cache-invalidációs bugok, beragadt verziók | **Kerülendő** — használj Workboxot |
| Két PDF-lib (jsPDF + pdfmake fontért) | Működő MVP-export | ~400KB+ felesleges bundle, dupla supply-chain, lassú import | **Soha** — egy libet válassz |
| CSP kikapcsolva (`null`) | Gyors fejlesztés | XSS → IPC/kulcs-szivárgás; blokkolja a biztonságos AI-kulcskezelést | **Soha** webes/AI kontextusban |
| `navigator.storage.persist()` elhagyása | Kevesebb kód | Csendes eviction → adatvesztés | Csak ha van megbízható backup/restore |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| LLM (OpenAI/Anthropic stb.) | Kulcs a kliens-bundle-ben; ügyféladat feltétel nélkül elküldve | BYOK session-scope; explicit adat-küldés-engedély; kikapcsolható; CSP bekapcsolva; (szerver-proxy csak ha van backend) |
| IndexedDB | `onupgradeneeded` verzió nem kezelt; blob-store séma nélkül | Tudatos DB-verziózás + rekord `schema_version`; runtime validáció (Zod) |
| Service Worker / CacheStorage | Cache-név bump törli az egészet; nincs update-prompt | Workbox precache (hash-alapú); network-first app-shell; „új verzió" UI |
| Böngésző-storage kvóta | Feltételezed, hogy az adat örök | `navigator.storage.persist()` + JSON backup/restore |
| PDF-font (magyar ékezet) | Alap font nem tartalmaz ékezeteket; teljes font beágyazva | Ékezetes glyphek subset-elve; modul-szintű cache |
| Jövőbeli sync-transport | Most beépíted a teljes sync-et | Csak *ready* modell (ID/tombstone/timestamp/version); a transport külön mérföldkő |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Auto-save minden billentyűleütésre (debounce nélkül) | UI-akadás gépelés közben; sok IO/IPC | Debounce (~500ms); mentés és lista-frissítés szétválasztása | Már a mai MVP-ben jelentkezik gyors gépelésnél |
| PDF-lib + font újratöltése minden exportnál | Lassú export-indítás, memória-tüske | Modul-szintű cache az import után | Minden export, lassabb gépen érezhető |
| Kliensoldali nagy PDF/Excel generálás | Tab-lefagyás, out-of-memory | pdfmake auto-tördelés; Web Worker; worst-case fixtúra teszt | Maximálisan kitöltött projekt, hosszú free-text, képek |
| Teljes lista újrarenderelése minden mentésnél | Lassú, akadó lista | Memoizáció; mentés ≠ lista-refresh | Sok projekt (több tíz+) |
| Kézzel épített xlsz XML memóriában | Memória-tüske nagy exportnál | Streaming xlsx lib | Sok projekt egyszerre exportálva |
| Tombstone-ok korlátlan halmozódása | Lassuló lekérdezés idővel | Alapból `deleted_at IS NULL` szűrés + indexelés | Nagyon hosszú élettartam mellett (5 fős skálán ritka) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| CSP kikapcsolva (`null`) | XSS → tetszőleges script → kulcs/adat-szivárgás | Szigorú CSP (`'self'` + szükséges források); a webes/AI munka **előfeltétele** |
| LLM-kulcs a kliens-kódban | Kulcslopás, pénzügyi kár órák alatt | Soha ne szállíts szolgáltatói kulcsot; BYOK + user-owned |
| Ügyféladat/PII az LLM-nek engedély nélkül | Adatvédelmi sértés (a felmérés ügyféladat!) | Explicit opt-in; átlátható „mi megy hová"; ZDR-korlátok kommunikálva |
| API-kulcs plaintext localStorage-ban | XSS/megosztott gép → kiolvasás | Session-scope alapból; perzisztálásnál figyelmeztetés; CSP |
| Betöltéskor `as Project` cast validáció nélkül | Korrupt adat csendben terjed, hibás számítás | Runtime séma-validáció (Zod) a betöltési úton |
| Egy origin megosztott storage-namespace | Másik app felülírja az adatot | Cache/DB nevek prefixelése |
| Nincs input-validáció (dátum/email/kötelező) | Korrupt adat → hibás readiness/döntés-score | `validateProject` mentés előtt, typed hibákkal |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Csendes SW-frissítés vagy „soha nem frissül" | Felhasználó régi appot lát / összezavarodik | „Új verzió elérhető — Frissítés" prompt kontrollált reload-dal |
| Nincs undo, minden azonnal mentődik | Véletlen mezőtörlés végleges | Soft delete + rövid undo-ablak; debounce-olt mentés |
| Nincs látható „hol az adatom / mentve?" jelzés | Local-first bizonytalanság, adat-félelem | Egyértelmű mentés-állapot; export/backup könnyen elérhető |
| Adat eltűnik cache-ürítés után magyarázat nélkül | Bizalomvesztés | `persist()` + backup-emlékeztető; import a visszaállításhoz |
| AI-hiba/lassulás blokkolja a flow-t | Az „opcionális" AI kötelezőnek hat | Determinisztikus fallback mindig; AI aszinkron, nem blokkoló; tiszta kill switch |
| PDF ékezet nélkül / tördelés elcsúszik | Nem-prezentálható output | Ékezetes font-subset; content-alapú tördelés (pdfmake); worst-case teszt |
| Coaching túl sok szöveggel elárasztja | Kognitív túlterhelés interjú közben | Progresszív feltárás (miért/hogyan/etikett rétegezve, igény szerint) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Adatmodell:** Van-e stabil ULID/UUIDv7 minden entitáson, és minden reláció *arra* hivatkozik? — hozz létre két rekordot „két eszközön" (két böngésző-profil) és nézd, ütköznek-e.
- [ ] **Törlés:** Tombstone (`deleted_at`) van, nem hard delete? — töröl, majd szimulált „régi állapot" visszahozza-e a rekordot.
- [ ] **Konfliktus-készenlét:** Van-e per-mező `updated_at` + monoton `version` + `actor_id`? — nélkülük a sync később *garantáltan* fájni fog.
- [ ] **Séma-verzió:** `schema_version` minden gyökér-rekordon + működő migrációs lánc régi fixtúrán tesztelve?
- [ ] **Backup/restore:** Teljes JSON export ÉS import működik, ékezetes/rész-kitöltött adaton is?
- [ ] **PWA-frissítés:** Új deploy után a felhasználó *kontrolláltan* kap friss verziót, nem ragad be, nem tölt újra mindent?
- [ ] **Offline-perzisztencia:** `navigator.storage.persist()` kérve; cache-ürítés után az adat backupból visszaállítható?
- [ ] **AI opcionalitás:** Az app *teljesen* működik AI kikapcsolva? Van valódi kill switch? Kulcs nincs a bundle-ben (`grep` a dist-ben)?
- [ ] **AI-adatvédelem:** A felhasználó explicit engedélye nélkül nem megy ügyféladat az LLM-nek?
- [ ] **PDF/Excel:** Worst-case (maximálisan kitöltött, hosszú free-text) fixtúrán tesztelve, nem csak üres MVP-adaton? Ékezetek jók?
- [ ] **Coaching-tartalom:** Adatfájlban van, nem kódban? Nem-fejlesztő tud-e kérdést/tippet hozzáadni?
- [ ] **CSP:** Bekapcsolva és szigorú (nem `null`)?
- [ ] **Migráció:** A régi Tauri-MVP valós adata importálható a webes appba?

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auto-increment/lokális ID kiderül sync előtt | HIGH | Egyszeri migráció: minden rekordnak ULID; relációk átírása régi→új ID map alapján; `schema_version` emelés. Minél később, annál több adat érintett. |
| Nincs tombstone, már van zombie-adat | MEDIUM | Soft-delete bevezetése; a már feltámadt duplikátumok kézi/heurisztikus deduplikálása |
| Blob-modell, mezőszintű merge kell | HIGH | Normalizálás entitás/mező szintre; per-mező timestamp visszamenőleges feltöltése (csak „most" időbélyeggel lehet — a múltbeli szerkesztések ideje elveszett) |
| Nincs `schema_version`, séma már változott | MEDIUM | Legrégebbit `v0`-nak feltételezve migrációs lánc; heurisztikus mező-detektálás; validáció hozzáadása |
| Kulcs kiszivárgott a kliensből | LOW (tech) / HIGH (pénz) | Kulcs azonnali visszavonása; BYOK-ra váltás; CSP bekapcsolás; audit a költségen |
| Beragadt PWA-verzió a felhasználóknál | MEDIUM | SW-frissítés kényszerítése (`clients.claim` + verzió-check); rosszabb esetben a felhasználót DevTools „Unregister SW"-re instruálni |
| Cache-ürítés miatt adatvesztés, nincs backup | HIGH | Nincs teljes helyreállítás — ezért kritikus a backup/restore *előre*. Csak részleges (böngésző-recovery ritkán) |
| PDF kliensen memóriát merít | MEDIUM | Web Workerbe tolás; pdfmake-re váltás; végső soron szerver-render (scope-nyitás) |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Stabil ID hiánya | Adatmodell/perzisztencia alapozó | Két „eszközön" létrehozott rekord nem ütközik |
| 2. Hard delete / zombie | Adatmodell/perzisztencia alapozó | Törölt rekord nem támad fel szimulált merge-nél |
| 3. Nincs per-mező merge | Adatmodell/perzisztencia alapozó | Két mező párhuzamos módosítása mindkettőt megőrzi |
| 4. Nincs séma-verzió | Adatmodell/perzisztencia alapozó | Régi fixtúra betölt migrációs láncon |
| 5. Nincs backup/validáció | Perzisztencia/backup fázis | Export→wipe→import visszaadja az adatot; korrupt adat látható hibát ad |
| 6. PWA cache/SW beragadás | PWA-shell/offline fázis | Deploy után kontrollált frissítés-prompt; nem tölt újra mindent |
| 7. LLM-kulcs kliensen | AI-integrációs fázis (+ CSP a PWA/biztonsági fázisban) | Kulcs nincs a dist-ben; AI kikapcsolható; nincs engedély nélküli PII-küldés |
| 8. Kliens PDF/Excel robbanás | Export/dokumentum fázis | Worst-case fixtúra hibátlan, ékezetes, nem fagyaszt |
| 9. Coaching kódba égetve | Coaching/tartalom-modell fázis | Új kérdés/tipp deploy nélkül (adatfájlból) |
| 10. MVP-adat migráció | Migrációs fázis (webes GA előtt) | Valós Tauri-adat importálva, validálva |
| 11. Scope-robbanás | Roadmap/fázistervezés szintje | Minden fázis „AI és sync nélkül is teljes" |
| 12. Óra-skew konfliktus | Adatmodell/perzisztencia alapozó | Monoton `version`/Lamport counter minden szinkronizálandó rekordon |

---

## A „most jól meghozandó" adatmodell-döntések — összefoglaló (sync-előkészítés magja)

Ez a milestone kritikus kérdésének direkt válasza. Ezek együtt teszik a jövőbeli max 5 fős syncet **fájdalommentessé**, anélkül, hogy most syncet építenél:

1. **Stabil, kliens-generált ID** (ULID/UUIDv7) minden entitáson; relációk csak ID-ra. *(Pitfall 1)*
2. **`actor_id` / `device_id`** per telepítés — tie-break és „ki írta" alapja. *(Pitfall 1, 12)*
3. **Tombstone** (`deleted_at`) hard delete helyett. *(Pitfall 2)*
4. **Per-mező (vagy szűk mezőcsoport) `updated_at`** — mezőszintű LWW merge-hez, blob-LWW helyett. *(Pitfall 3)*
5. **Monoton `version` counter (→ Lamport/HLC-készenlét)** minden szinkronizálandó rekordon — óra-skew ellen. *(Pitfall 12)*
6. **`schema_version`** minden gyökér-rekordon + verzió-kulcsolt migrációs lánc. *(Pitfall 4, 10)*
7. **Teljes JSON export/import** — backup, migráció és jövőbeli sync-bootstrap egyben. *(Pitfall 5, 10)*
8. **Runtime séma-validáció (Zod)** a betöltési úton. *(Pitfall 5)*
9. **`UserContext` stub (`{ userId: "local" }`)** átvezetve a storage-rétegen — jövőbeli auth-refaktor minimalizálása, auth-építés nélkül. *(Pitfall 11)*
10. **Normalizáltabb modell**, mint az egy-blob — legalább entitás-szintre bontva, hogy 3–5. egyáltalán értelmezhető legyen. *(Pitfall 3)*

Amit **NE** csinálj most (túlméretezés): valódi sync-transport, konfliktus-feloldó UI, teljes CRDT-runtime (kivéve esetleg egyetlen hosszú-szöveg mezőnél), auth-rendszer, elosztott-konszenzus garanciák.

---

## Sources

- [Local-First Apps in 2025: CRDTs, Replication Patterns, and Edge Storage — debugg.ai](https://debugg.ai/resources/local-first-apps-2025-crdts-replication-edge-storage-offline-sync) — CRDT vs LWW, per-field timestamps, actor IDs *(MEDIUM)*
- [Cool front-end arts of local-first: storage, sync, conflicts — Evil Martians](https://evilmartians.com/chronicles/cool-front-end-arts-of-local-first-storage-sync-and-conflicts) — konfliktus-granularitás, mikor kell CRDT vs LWW *(MEDIUM)*
- [Local-First Architecture: CRDTs & Sync Engines — AppScale Blog](https://appscale.blog/en/blog/local-first-architecture-crdts-sync-engines-offline-first-2026) — Lamport clocks, tombstones, metadata *(MEDIUM)*
- [Using CRDTs + Sync as a Database — Patrick Jackson](https://jackson.dev/post/crdts_as_database/) — op-log, tombstone, konvergencia *(MEDIUM)*
- [Production-Ready Smart Caching for PWA with Service Workers and IndexedDB — DEV](https://dev.to/pablo_74/production-ready-smart-caching-for-pwa-with-service-workers-and-indexeddb-43c5) — cache-verziózás, multi-app namespace *(MEDIUM)*
- [Update — web.dev (Learn PWA)](https://web.dev/learn/pwa/update) — SW életciklus, frissítési UX *(HIGH)*
- [When 'Just Refresh' Doesn't Work: Taming PWA Cache Behavior — Infinity Interactive](https://iinteractive.com/resources/blog/taming-pwa-cache-behavior) — beragadt verzió, stale-cache *(MEDIUM)*
- [Best Practices for API Key Safety — OpenAI Help Center](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) — kulcs sosem a kliensben *(HIGH)*
- [Secure API Keys & Prompts in Client-Side JS AI Agents — NileshBlog](https://nileshblog.tech/secure-api-keys-prompts-client-side-js-ai-agents/) — kliensoldali kulcs-expozíció, proxy-minta *(MEDIUM)*
- [Bring Your Own API Key — Warp docs](https://docs.warp.dev/agent-platform/inference/bring-your-own-api-key/) — BYOK user-szintű kulcskezelés, ZDR-korlátok *(MEDIUM)*
- [Top JavaScript PDF generator libraries for 2026 — Nutrient](https://www.nutrient.io/blog/top-js-pdf-libraries/) — jsPDF vs pdfmake, memória-korlát, font-subset *(MEDIUM)*
- [jsPDF (GitHub) — parallax/jsPDF](https://github.com/parallax/jsPDF) — nincs layout API, kézi koordináták *(HIGH)*
- Projekt-belső: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md` — a mai MVP azonosított kockázatai *(HIGH)*

---
*Pitfalls research for: local-first sync-ready offline PWA PM/PO felmérő eszköz*
*Researched: 2026-07-08*
