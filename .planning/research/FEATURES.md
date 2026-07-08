# Feature Research

**Domain:** Követelmény-elicitációs / discovery / project-intake / interjú-támogató web/PWA eszköz PM/PO-knak (spec-from-conversation + coaching réteg)
**Researched:** 2026-07-08
**Confidence:** MEDIUM (domain-gyakorlatok és versenytárs-funkciók HIGH; a determinisztikus, AI-mentes coaching konkrét mintái MEDIUM — kevés direkt precedens, analógiából vezetve)

## Kontextus-összefoglaló

A meglévő MVP (projekt-CRUD, checklist-intake, readiness/döntési pontszám, PDF/Excel export, magyar UI, lokális tárolás) a domain **table stakes** rétegét már lefedi. A verseny (Aha! Discovery, Dovetail, Productboard, ChatPRD, StoriesOnBoard) két dolgot csinál jól, amit az MVP még nem: (1) **guided, playbook-vezérelt discovery flow** és (2) **beszélgetés → strukturált követelmény/AC** transzformáció. A Project-Maker egyedi tétje egy harmadik, a piacon alig lefedett dimenzió: a **determinisztikus, AI-mentes coaching/edukációs réteg**, ami a felhasználót "junior → senior project leader" úton emeli. Ez a fő differenciáló — ide koncentráljon a fejlesztés.

## Feature Landscape

### Table Stakes (Users Expect These)

Amit a felhasználó feltételez, hogy létezik. Hiánya = a termék félkésznek hat.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Projekt-CRUD + lista/archívum | Alap munkaszervezés; több felmérést kell párhuzamosan kezelni | LOW | MVP-ben megvan; web-re portolandó |
| Strukturált, guided kérdés-sorozat (nem szabad szöveg) | Minden discovery-eszköz "guided question set"-tel dolgozik; ez adja a struktúrát | MEDIUM | MVP checklist ennek elődje; kérdés-metaadat (típus, kötelezőség, kategória) kell hozzá |
| Válaszok strukturált rögzítése + auto-mentés | Adatvesztés elfogadhatatlan interjú közben | LOW | MVP-ben megvan; web-en debounce-olt mentés + PWA offline puffer |
| Haladás-jelző / completion % | A felhasználó látni akarja, hol tart és mi hiányzik | LOW | MVP readiness % ezt fedi; szekciónkénti bontás kell |
| Readiness / döntési pontszám | "Mennyire kész a spec?" gyors jelzés — az intake érték magja | MEDIUM | MVP-ben megvan; a scoring-szabályokat a playbook-hoz kell kötni |
| Ember-olvasható export (PDF + Excel) | A spec-et megosztják stakeholderrel; a fájl-formátum elvárás | MEDIUM | MVP-ben megvan; dinamikus tördelés a bővítés (lásd differenciálók) |
| Követelmény-metaadat: ID, forrás, prioritás, státusz | Traceability minden RM-eszköz alapja; a nyitott kérdésekhez is kell | MEDIUM | Stabil azonosító + a válaszhoz kötött forrás; NEM teljes DOORS-szintű mátrix (lásd anti-feature) |
| Magyar UI + magyar kérdés/coaching-tartalom | Célfelhasználók magyar nyelvűek (PROJECT constraint) | LOW | i18n-kész struktúra, de egyelőre HU-only tartalom |
| Szerkeszthetőség / válaszok utólagos módosítása | A discovery iteratív; a válaszok visszamenőleg finomodnak | LOW | Recompute-on-edit minta (MVP `recalculateProject`) |

### Differentiators (Competitive Advantage)

Ami megkülönbözteti a terméket. Nem kötelező, de értékes — és a PROJECT alapértékéhez illeszkedik.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Kérdésenkénti coaching-panel** (MIÉRT fontos / MIT ad technikailag / HOGYAN kérdezz business nyelven / tárgyalási ETIKETT) | A fő differenciáló: a felhasználót fejleszti, nem csak adatot rögzít. Piaci fehér folt. | MEDIUM | Determinisztikus tartalom kérdés-metaadatként; UX-minta: contextual help / progresszív feltárás (nem modal-özön). 4 fix rovat kérdésenként |
| **"Jó válasz így néz ki" minták + inline tippek gyenge válaszra** | Válaszminőség-terelés élő AI nélkül; a senior gondolkodást demonstrálja | MEDIUM | Determinisztikus heurisztikák: hossz, tiltott homályos szavak ("user-friendly", "gyors", "stb."), kötelező elemek megléte → inline nudge. Példaválasz kérdéshez rögzítve |
| **Projekttípus-specifikus playbookok / kérdés-sablonok** | Egy web-app, egy integráció, egy belső eszköz más discovery-t igényel; a sablon adja a "senior tudja mit kérdezzen" élményt | MEDIUM-HIGH | Playbook = kérdéskészlet + scoring-súlyok + AC-sablonok egy csomagban. Verziózható tartalom-adatmodell kell |
| **Development-ready Markdown spec-csomag** | Elsődleges output; egyszerre AI-barát és ember-olvasható (PROJECT kulcsdöntés) | MEDIUM | Válaszok → szekcionált Markdown (cél, scope, szereplők, követelmények, AC, nyitott kérdések). Determinisztikus template-motor |
| **Acceptance criteria / user story generálás válaszokból** | "3 C's" Confirmation lépés automatizálása; a spec-et fejleszthetővé teszi | MEDIUM-HIGH | Determinisztikus: kérdés-válasz → sablon-alapú US ("Mint <szerep>, szeretnék <cél>, hogy <érték>") + Gherkin-szerű AC. LLM opcionálisan finomít |
| **Nyitott kérdések automatikus gyűjtése** | Homályos/hiányos/kihagyott válaszból lista → a "még tisztázandó" a discovery értékének fele | MEDIUM | A minőség-heurisztikákra épül (lásd függőség); minden gap → tételes nyitott-kérdés bejegyzés a spec-be |
| **INVEST / Definition-of-Ready minőség-ellenőrző** | A generált story-kat szabvány szerint minősíti; edukációs is (megtanítja a kritériumokat) | MEDIUM | Determinisztikus checklist-pontozás story-nként; a coaching-réteg magyarázza a bukott kritériumot |
| **Dinamikus tördelésű, szerkeszthető PDF/Excel export** | A szövegdoboz a tartalomhoz igazodik — nem csonkol; szerkeszthető kimenet | MEDIUM-HIGH | PROJECT active követelmény; auto-magasság/flow layout kell a PDF-motorban |
| **Opcionális LLM-augmentáció** (minőség-értékelés, utókérdés-javaslat, spec-finomítás) | Kikapcsolható rásegítés a determinisztikus rétegre; nem előfeltétel | HIGH | PROJECT constraint: soha nem kötelező. Feature-flag mögött; a determinisztikus út mindig teljes marad |
| **Interjú-mód UX** (élő felvétel közbeni, gyors, terelő felület) | A discovery "0. lépése" az interjú; a folyékony rögzítés versenyelőny | MEDIUM | Egységes interjú+checklist élmény (PROJECT kulcsdöntés); billentyű-navigáció, minimál kattintás |

### Anti-Features (Commonly Requested, Often Problematic)

Ami jónak tűnik, de problémát okoz — dokumentálva a scope-creep ellen.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Kötelező / mindig-bekapcsolt élő AI | "Az AI okosabbá teszi" | PROJECT constraint sérül; törékeny (API-függés, költség, adatvédelem); a determinisztikus érték elsorvad | AI opcionális feature-flag; a coaching + minőség-heurisztika AI nélkül is teljes |
| Teljes DOORS/Jama-szintű traceability-mátrix (verifikáció-allokáció, subsystem-lánc) | "Enterprise RM így csinálja" | Zárt, max 5 fős körre brutális túltervezés; a felmérési UX-et megöli | Könnyű metaadat (ID, forrás, prioritás, státusz) + nyitott-kérdés lista; a lánc utólagos MMP |
| Valós idejű többfelhasználós együttszerkesztés most | "Csapatban dolgozunk" | PROJECT: a sync külön, későbbi mérföldkő; CRDT/OT komplexitás túl korai | Séma-verziózás + backup/restore most (sync-előkészítés); egyfelhasználós flow |
| Automatikus interjú-ütemezés / naptár-integráció | Az Aha!/enterprise "automated discovery" ezt hirdeti | Naptár-OAuth és scheduling nem az alapértékhez tartozik; nagy felület, kis haszon | A felmérési+coaching élményre fókusz; ütemezés kézi |
| Hang-/videó-transzkripció és auto-tagging most | "Csak beszéljek, a gép leírja" | Transzkripció-pontosság, adatvédelem, nagy AI-függés; a manuális, terelő rögzítés edukatívabb | Gyors gépelős interjú-mód; transzkripció esetleg későbbi, opcionális LLM-modul |
| Merev, egyutas wizard, ami nem enged visszaugrani | "Vezessük végig lépésről lépésre" | A discovery nemlineáris; a válaszok iterálnak; frusztráló | Szabad navigáció szekciók közt + haladás-jelző + progresszív feltárás |
| Túltolt gamifikáció (pontok, jelvények, szintek) | "Motiváljuk a junior usert" | Szakmai eszközben komolytalan; elvonja a fókuszt a tartalomról | Érdemi coaching + "senior így csinálná" minták; a fejlődés a jobb specekben látszik |
| Korlátlan szabad-szöveg struktúra nélkül | "Ne kényszerítsünk kérdésekbe" | Elveszik a strukturálhatóság; nem lesz spec/AC belőle; a minőség-terelés lehetetlen | Guided kérdéskészlet strukturált mezőkkel; szabad szöveg csak jegyzet-rovatban |

## Feature Dependencies

```
Kérdés-metaadat modell (típus, kategória, kötelezőség, súly, példaválasz, coaching-rovatok)
    ├──requires──> Playbook / kérdés-sablon rendszer (verziózott tartalom)
    │                   └──requires──> Séma-verziózás (PROJECT: sync-előkészítés)
    ├──enables───> Kérdésenkénti coaching-panel
    ├──enables───> "Jó válasz" minták + inline minőség-tippek
    │                   └──enables──> Nyitott kérdések auto-gyűjtése
    │                                       └──feeds──> Markdown spec-csomag
    └──enables───> AC / user story generálás
                        ├──requires──> Markdown spec-csomag (template-motor)
                        ├──enhanced-by──> INVEST / DoR minőség-ellenőrző
                        └──enhanced-by──> Opcionális LLM-augmentáció

Readiness/döntési pontszám ──requires──> Playbook scoring-súlyok
Dinamikus PDF/Excel export ──requires──> Markdown spec-csomag (mint kanonikus forrás)
Interjú-mód UX ──consumes──> Playbook + coaching-panel
```

### Dependency Notes

- **Minden a kérdés-metaadat modellre épül:** ez a fundamentum. A coaching, a minőség-terelés, a scoring, az AC-generálás mind a kérdéshez rögzített metaadatból táplálkozik. Ezt kell először és jól megtervezni.
- **Playbook → séma-verziózás:** a verziózott kérdés-tartalom migrálhatósága a PROJECT sync-előkészítési követelményéhez kötődik; a tartalom-séma verzióját külön kell kezelni.
- **Minőség-heurisztika → nyitott kérdések → spec:** a gyenge/hiányzó válasz detektálása egyszerre táplálja az inline tippet ÉS a nyitott-kérdés listát; ugyanaz a szabálymotor, két kimenettel.
- **Markdown a kanonikus forrás:** az AC-generálás és a PDF/Excel export egyaránt a strukturált Markdown spec-ből származzon (single source of truth), ne külön-külön a nyers válaszokból — így nincs divergencia.
- **LLM csak enhancer:** minden LLM-funkciónak van determinisztikus alapja, amit finomít; az LLM kikapcsolva a lánc nem törik.

## MVP Definition

### Launch With (v1 — e mérföldkő magja)

- [ ] Kérdés-metaadat modell + legalább 1-2 playbook (pl. "web-app", "belső eszköz") — mindennek az alapja
- [ ] Egységes guided interjú+checklist flow szabad navigációval és haladás-jelzővel — az élmény gerince
- [ ] Kérdésenkénti coaching-panel (4 rovat: miért / mit ad / hogyan kérdezz / etikett) — a fő differenciáló
- [ ] Determinisztikus minőség-heurisztika: inline tippek + "jó válasz így néz ki" minták — AI-mentes terelés
- [ ] Nyitott kérdések auto-gyűjtése — a heurisztika ingyenes mellékterméke
- [ ] Development-ready Markdown spec-csomag generálás — az elsődleges output
- [ ] Readiness/döntési pontszám a playbook-súlyokra kötve — MVP-képesség portolása
- [ ] Séma-verziózás + backup/restore — PROJECT constraint, blokkolja a jövőt ha kimarad

### Add After Validation (v1.x)

- [ ] AC / user story generálás + INVEST/DoR minőség-ellenőrző — a spec fejleszthetővé tétele; a Markdown-mag validálása után
- [ ] Dinamikus tördelésű, szerkeszthető PDF/Excel export — miután a Markdown-forrás stabil
- [ ] További playbookok (integráció, migráció, adat-projekt) — a sablon-rendszer bevált után

### Future Consideration (v2+)

- [ ] Opcionális LLM-augmentáció — csak miután a determinisztikus lánc teljes és validált (különben az AI elfedi a hiányos alapot)
- [ ] Tényleges multi-user sync — külön mérföldkő (PROJECT out of scope)
- [ ] Interjú-transzkripció / hang-input — nagy AI-függés, halasztandó

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Kérdés-metaadat modell + playbook | HIGH | MEDIUM | P1 |
| Guided interjú+checklist flow | HIGH | MEDIUM | P1 |
| Kérdésenkénti coaching-panel | HIGH | MEDIUM | P1 |
| Minőség-heurisztika + "jó válasz" minták | HIGH | MEDIUM | P1 |
| Nyitott kérdések auto-gyűjtése | HIGH | LOW | P1 |
| Markdown spec-csomag | HIGH | MEDIUM | P1 |
| Séma-verziózás + backup/restore | MEDIUM | MEDIUM | P1 |
| Readiness/döntési pontszám | MEDIUM | LOW | P1 |
| AC / user story generálás | HIGH | HIGH | P2 |
| INVEST/DoR ellenőrző | MEDIUM | MEDIUM | P2 |
| Dinamikus PDF/Excel export | MEDIUM | HIGH | P2 |
| Opcionális LLM-augmentáció | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Launch-hoz kötelező (a mérföldkő magja)
- P2: Kívánatos, validálás után
- P3: Későbbi megfontolás

## Competitor Feature Analysis

| Feature | Aha! Discovery / Dovetail / Productboard | ChatPRD / StoriesOnBoard | Our Approach |
|---------|------------------------------------------|--------------------------|--------------|
| Guided interjú-flow | Playbook + strukturált interjú-rögzítés (Aha!) | Guided prompt-lánc (ChatPRD) | Playbook-vezérelt egységes interjú+checklist, HU tartalommal |
| Beszélgetés → követelmény | AI copilot klaszterezi a jegyzeteket (Dovetail témák) | LLM generál PRD/story-t promptból | **Determinisztikus** template-motor; LLM csak opcionális enhancer |
| AC / user story generálás | Részleges (Elle/AI) | Erős, de LLM-függő | Sablon-alapú US+Gherkin AI nélkül; INVEST-ellenőrzés |
| Coaching / edukáció | Gyakorlatilag nincs — az eszköz feltételezi a senior tudást | Nincs; a promptolás a userre marad | **Fő differenciáló:** kérdésenkénti miért/mit/hogyan/etikett |
| Minőség-terelés | AI-alapú, ha van | AI-alapú | Determinisztikus heurisztika + "jó válasz" minta AI nélkül |
| Adatmodell / traceability | Nehéz enterprise mátrix | Könnyű/nincs | Könnyű metaadat, zárt 5-fős körre szabva |
| Nyelv | EN-first | EN-first | HU-first |

## Sources

- [Requirements Elicitation — GeeksforGeeks](https://www.geeksforgeeks.org/software-engineering/software-engineering-requirements-elicitation/) — HIGH (elicitáció-technikák)
- [Requirements Elicitation — Wikipedia](https://en.wikipedia.org/wiki/Requirements_elicitation) — MEDIUM (áttekintés)
- [Jama Software — Requirements gathering guide](https://www.jamasoftware.com/requirements-management-guide/requirements-gathering-and-management-processes/what-is-requirements-gathering/) — HIGH (traceability, metaadat)
- [Convert requirements into user stories & AC — TechVariable](https://techvariable.com/blogs/how-to-convert-requirements-into-user-stories-and-acceptance-criteria) — MEDIUM
- [User Stories 3 C's & AC — AltexSoft](https://www.altexsoft.com/blog/user-stories/) — HIGH
- [Gherkin User Stories AC guide — TestQuality](https://testquality.com/gherkin-user-stories-acceptance-criteria-guide/) — MEDIUM
- [INVEST — Agile Alliance](https://agilealliance.org/glossary/invest/) — HIGH
- [Definition of Ready templates — Vit Lyoshin](https://vitlyoshin.com/blog/definition-of-ready/) — MEDIUM
- [Onboarding Tutorials vs. Contextual Help — NN/G](https://www.nngroup.com/articles/onboarding-tutorials/) — HIGH (coaching-UX minták)
- [App onboarding best practices — Userpilot](https://userpilot.com/blog/app-onboarding-best-practices/) — MEDIUM (progresszív feltárás, coach marks)
- [Product Discovery Questions — Productboard](https://www.productboard.com/blog/essential-product-discovery-questions-for-impactful-product-development/) — HIGH (playbook/kérdés-sablon)
- [Product discovery interview template — Product-Led Alliance](https://www.productledalliance.com/product-discovery-interview-questions-framework/) — MEDIUM
- [AI PRD generators comparison — BuildBetter](https://blog.buildbetter.ai/best-chatprd-alternatives-in-2026-ai-prd-generators-for-product-teams/) — MEDIUM (ChatPRD/Dovetail/Aha! funkciók)
- [Best AI tools for PMs 2026 — Nimbalyst](https://nimbalyst.com/blog/best-ai-tools-for-product-managers-2026/) — MEDIUM
- [Common mistakes in requirements gathering — Redstar](https://redstartechs.com/blog/5-common-mistakes-in-requirements-gathering) — MEDIUM (anti-feature/pitfall alap)
- [Advancing Requirements Engineering through Generative AI (LLMs) — arXiv](https://arxiv.org/pdf/2310.13976) — MEDIUM (LLM szerepe/korlátok)

---
*Feature research for: követelmény-elicitációs / discovery / interjú-támogató eszköz coaching réteggel*
*Researched: 2026-07-08*
