# Project-Maker

## Mi ez

A Project-Maker egy **web/PWA alapú felmérő és igény-tisztázó eszköz PM/PO-knak**, amely végigvezeti a felhasználót egy ügyfél-felmérésen (akár élő interjú közben), közben coachingszerűen edukálja, és a végén **development-ready** outputot állít elő: strukturált Markdown spec-csomagot, acceptance criteria / user story-kat, valamint a még tisztázandó **nyitott kérdések** listáját.

Jelenleg egy lokális asztali MVP (Tauri) validálta az alapötletet; ez a mérföldkő **webes platformra emeli és kibővíti**, a felmérési élményt újragondolva és egy edukációs (coaching) réteggel kiegészítve.

## Alapérték

Egy ügyfél-felmérésből a lehető leggyorsabban **konkrét, „agentic development"-re alkalmas, development-ready igény** szülessen — miközben az app a használóját is a „junior → senior project leader" úton emeli.

## Követelmények

### Validated

<!-- A lokális MVP által igazolt, értékes képességek. A KONKRÉT megvalósításuk szabadon újratervezhető — a stack nyitott; ezek elvárt KÉPESSÉGEK, nem rögzített implementáció. -->

- ✓ Projektek felvétele és kezelése (CRUD) — MVP
- ✓ Checklist-alapú, strukturált felmérés / intake — MVP
- ✓ Készültségi (readiness) és döntési pontszám számítása — MVP
- ✓ Ember-olvasható PDF és Excel export — MVP
- ✓ Magyar nyelvű felhasználói felület — MVP
- ✓ Önálló, helyi adattárolás automatikus mentéssel — MVP

### Active

<!-- Ennek a mérföldkőnek a hatóköre. Hipotézisek, amíg le nem szállítjuk és nem validáljuk. -->

- [ ] Web/PWA platformra való átállás (a konkrét stacket a kutatás javasolja)
- [ ] Egységes, újragondolt felmérési élmény (interjú + checklist egyben)
- [ ] Kérdés-sablonok / playbook, amely végigvezet a felmérésen
- [ ] Coaching-réteg kérdésenként: *miért* fontos, *mit* ad technikailag, *hogyan* kérdezz business nyelven, mi a tárgyalási **etikett**
- [ ] Inline tippek gyenge / hiányos válaszokhoz
- [ ] Development-ready output: strukturált Markdown spec-csomag
- [ ] Acceptance criteria / user story generálása a válaszokból
- [ ] Nyitott kérdések automatikus gyűjtése (homályos / hiányos válaszokból)
- [ ] Dinamikus tördelésű, szerkeszthető PDF/Excel export (a szövegdoboz a tartalom mennyiségéhez igazodik)
- [ ] Letisztult, könnyen kezelhető UI/UX
- [ ] Opcionális élő AI-integráció (LLM): válaszminőség-értékelés, utókérdés-javaslat, spec-generálás — kikapcsolható
- [ ] Sync-előkészítés az architektúrában: séma-verziózás + adat-backup/restore

### Out of Scope

<!-- Explicit határok, indoklással, hogy ne kerüljön vissza. -->

- Tényleges multi-user cloud sync megvalósítása — külön, későbbi mérföldkő (most csak *előkészítés*); a cél zárt kör, max 5 felhasználó
- Felhasználói authentikáció / identitáskezelés — a sync mérföldkővel érkezik
- Kötelező élő AI — az AI opcionális, nem előfeltétel; az app AI nélkül is teljes értékű
- Mobil-natív alkalmazás — a web/PWA az irány
- Kemény offline garancia — az offline rugalmas cél, nem korlát

## Kontextus

- A jelenlegi MVP (Tauri 2 + React + Rust/SQLite, Windows telepítő) **lokálisan validálta az alapötletet**. A felhasználó szerint a teljes kódbázis és stack szabadon átalakítható — javasolható jobb/optimálisabb, webre szabott keret.
- A kódbázis-feltérképezés (`.planning/codebase/`) több, az újratervezésnél releváns figyelmeztetést adott: kikapcsolt CSP, **séma-verziózás hiánya** (blokkolja a jövőbeli migrációt), **nincs adat-backup**, túlterhelt `App.tsx` state, hiányzó CI, nincs Rust-oldali teszt.
- Domain: PM/PO munkafolyamatok, ügyfél-igényfelmérés, követelmény-tisztázás — a felmérés „0. lépése" már az interjúnál.
- A célfelhasználók magyar nyelvűek; a UI magyar.
- A `future_scaling.md` többfelhasználós, felhő-alapú (Azure / PostgreSQL / Entra ID) jövőképet vázol — a webes irány ezzel összecseng.

## Korlátok

- **Platform**: Web / PWA — a jövőbeli sync és a hozzáférhetőség miatt.
- **Nyelv**: Magyar UI — a célfelhasználók magyar nyelvűek.
- **AI**: Opcionális, kikapcsolható — nem lehet kötelező függőség; alapból determinisztikusan (sablon + coaching) működjön.
- **Offline**: Rugalmas — a PWA-offline előnyös, de nem kemény elvárás.
- **Adat**: Sync-re felkészített adatmodell (séma-verziózás, backup/restore) már ebben a körben.
- **Skálázás**: Zárt kör, a sync-célnál max 5 felhasználó — nem publikus, nagy volumenű rendszer.

## Kulcsdöntések

| Döntés | Indoklás | Kimenet |
|--------|----------|---------|
| Web/PWA platform (el a desktoptól) | A jövőbeli 5-fős sync és a hozzáférhetőség webben természetesebb | — Függőben |
| A stack nyitott; a kutatás javasolja | A vízióhoz optimális, webre szabott keret kiválasztása | — Függőben |
| Opcionális élő AI (nem kötelező) | Coaching/minőség erősítése úgy, hogy AI nélkül is teljes legyen | — Függőben |
| Egységes felmérési élmény (interjú + checklist) | Koherensebb, egyszerűbb UX | — Függőben |
| Elsődleges output: strukturált Markdown | Egyszerre AI-barát és ember-olvasható | — Függőben |
| Sync most csak előkészítés | Fókusz a felmérési élményen; a sync külön mérföldkő | — Függőben |
| Edukáció first-class képességként | A cél a használó „junior → senior" fejlesztése, nem csak adatrögzítés | — Függőben |

## Evolution

Ez a dokumentum a fázisváltásoknál és a mérföldkő-határokon fejlődik.

**Minden fázisváltás után** (`/gsd-transition`):
1. Megdőlt egy követelmény? → Out of Scope-ba, indoklással
2. Validálódott egy követelmény? → Validated-be, fázis-hivatkozással
3. Új követelmény merült fel? → Active-hoz
4. Rögzítendő döntés? → Kulcsdöntésekhez
5. A „Mi ez" még pontos? → Frissítés, ha elcsúszott

**Minden mérföldkő után** (`/gsd-complete-milestone`):
1. Minden szakasz teljes átnézése
2. Alapérték-ellenőrzés — még ez a helyes prioritás?
3. Out of Scope audit — az indokok még érvényesek?
4. Kontextus frissítése az aktuális állapottal

---
*Utoljára frissítve: 2026-07-08 az inicializálás után*
