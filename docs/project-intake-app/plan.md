# Project Intake App - MVP terv

## Kiinduló döntések

- Platform: lokális/offline-first alkalmazás.
- Célállapot MVP-ben: egyfelhasználós belső használat.
- Későbbi bővítési irány: közös munka támogatása, de az MVP ne igényeljen jogosultságkezelést.
- Kérdésséma: hibrid modell, a PDF szekcióira és az Excel részletes checklistjére építve.
- Projekt létrehozás: az "Új projekt felmérése" gomb azonnal létrehoz egy draft rekordot.
- Draft név: ha nincs még projektneve, automatikus név: "Névtelen projekt - yyyy.mm.dd hh:mm".
- Projekt státusz: az Excel logikája szerint: Előkészítés, Becslés alatt, Fejlesztésre kész, Blokkolt.
- Kitöltöttség: automatikusan számolt állapot, nem kézzel választott mező.
- Export: PDF és Excel export manuális művelettel, az app saját mappájába.
- Verziótörténet: MVP-ben nem szükséges, az aktuális állapot tárolása elég.
- Archivált elem törlése: végleges törlés.

## Termék cél

Az alkalmazás PM-eknek és PO-knak segít egy IT projektindítási vagy igényfelmérési folyamat strukturált rögzítésében. A cél nem csak kérdések megválaszolása, hanem annak eldöntése is, hogy a projekt becsülhető-e, indítható-e, vagy további pontosításra szorul.

## Fő nézetek

### Főmenü

Két fő művelet:

- Új projekt felmérése
- Meglévő projektek

### Új projekt felmérése / szerkesztés

Azonnal létrejön egy új projekt draft. A felhasználó egymás alatt látja a mezőket és checklist szekciókat. Minden mezőváltozás automatikusan mentődik.

A nézet tartalmazza:

- projekt alapadatok
- lista nézetben is megjelenő metaadatok
- PDF-ből származó fő igényfelmérési szekciók
- Excelből származó 30 pontos checklist
- nyitott kérdések / follow-up lista
- döntési összefoglaló

### Meglévő projektek

Táblás nézet aktív projektekkel. Létrehozás innen nem lehetséges, csak a főmenü "Új projekt felmérése" gombjával.

Oszlopok:

- Projekt neve
- Kapcsolat elérhetősége
- Állapota
- Prioritás
- Határidő
- Kitöltöttség

Műveletek:

- megtekintés
- szerkesztés
- archiválás

### Archívum

Az aktív listához hasonló táblás nézet, csak archivált projektekkel.

Műveletek:

- re-open: visszakerül az aktív projektek közé
- delete: végleges törlés

## Adatmodell vázlat

### Project

- id
- name
- customerOrOrganization
- projectManager
- businessAnalyst
- productOwner
- techLead
- affectedTeamOrVendor
- contactPhone
- contactEmail
- contactOther
- kickoffDate
- plannedDecisionDate
- status
- priority
- deadline
- completionState
- completionPercent
- businessProblem
- expectedBusinessOutcome
- firstMvpGoal
- archivedAt
- createdAt
- updatedAt

### ChecklistItemAnswer

- id
- projectId
- checklistItemId
- status
- owner
- dueDate
- answer
- openQuestion
- nextStep
- updatedAt

### ChecklistTemplateItem

- id
- category
- controlPoint
- exampleQuestion
- hint
- requiredForMvp
- requiredForEstimate
- blockingIfMissing
- source
- displayOrder

### FollowUpQuestion

- id
- projectId
- sourceChecklistItemId
- category
- question
- owner
- dueDate
- status
- decisionOrAnswer
- nextStep

### Export

- id
- projectId
- type
- filePath
- createdAt

## Kitöltöttség számítása

MVP-ben a kitöltöttség automatikusan számolható a checklist válaszok alapján.

Javasolt logika:

- "Kész", ha minden MVP-kötelező és becsléshez blokkoló elem Kész vagy Nem releváns.
- "Pontosítás szükséges", ha van blokkoló elem Nincs meg vagy Részben megvan.
- "Folyamatban", ha nincs blokkoló hiány, de még nem teljes a checklist.

Százalék:

- Kész pontok / (összes pont - Nem releváns pontok)

## Döntési összefoglaló logika

Az Excel alapján az alkalmazás számolja:

- összes checklist pont
- kész pontok száma
- részben megvan pontok száma
- nincs meg pontok száma
- nem releváns pontok száma
- készültség százalék
- MVP-kritikus hiányok száma
- becslést blokkoló hiányok száma
- nyitott follow-up kérdések száma
- becslés adható-e
- fejlesztés indítható-e

## Dropdown / választó mezők

### Single-select mezők

- projekt státusz: Előkészítés, Becslés alatt, Fejlesztésre kész, Blokkolt
- prioritás: Kiemelt, Fontos, Alap, Alacsony
- checklist státusz: Nincs meg, Részben megvan, Kész, Nem releváns
- follow-up státusz: Nyitott, Folyamatban, Megválaszolva, Blokkolt, Nem releváns
- döntés: Go, Feltételes Go, No-Go

### Multi-select mezők

- érintett csapat / szállító
- kapcsolódó rendszerek
- érintett szerepkörök
- kockázattípusok
- export cél vagy melléklet típusok, ha később szükséges

## Offline-first architektúra javaslat

MVP-re három reális irány:

1. Desktop app helyi adatbázissal
   - Példa: Electron vagy Tauri + SQLite.
   - Erős offline működés, jó fájlkezelés, kényelmes export.

2. PWA helyi tárolással
   - Példa: React/Vue/Svelte + IndexedDB.
   - Mobilbarátabb, de export és fájlrendszer-kezelés korlátozottabb lehet.

3. Web app lokális backenddel
   - Példa: local web server + SQLite.
   - Fejlesztésbarát és később könnyebben többfelhasználósítható, de telepítésben kevésbé "app-szerű".

Ajánlott MVP irány: Tauri vagy Electron + SQLite, mert az offline-first, export és helyi fájltárolás együtt itt a legtermészetesebb.

## Feladatbontás

### 1. Alkalmazás váz és navigáció

Goal: létrejön a főmenü, az új projekt indítás, a meglévő projektek és az archívum alap navigációja.

Context: a felhasználó két fő gombos indítóképernyőt szeretne, PC/laptop/mobil kompatibilis felülettel.

Acceptance criteria:

- A főmenüben látható az "Új projekt felmérése" és a "Meglévő projektek" gomb.
- Új projekt indításakor létrejön egy draft projekt.
- A meglévő projektek és archívum külön nézetben érhető el.
- A visszalépés nem veszít adatot.

Verify:

- Indíts új projektet, lépj vissza, majd nyisd meg a meglévő projektek listáját.
- A draft projekt megjelenik.

### 2. Helyi adattárolás és autosave

Goal: minden projektadat és checklist válasz helyben, automatikusan mentődjön.

Context: MVP-ben egy felhasználó dolgozik, nincs audit log, de minden mezőváltozás után menteni kell.

Acceptance criteria:

- Projekt létrehozáskor rekord jön létre.
- Minden mezőváltozás automatikusan mentődik.
- App bezárás és újranyitás után az aktuális állapot visszatöltődik.
- Archivált projektek nem jelennek meg az aktív listában.

Verify:

- Módosíts mezőt, zárd be az appot, nyisd újra, ellenőrizd az adatot.
- Archiválj projektet, majd ellenőrizd az aktív és archív nézetet.

### 3. Hibrid kérdésséma importálása

Goal: az Excel és PDF tartalma alapján létrejön a digitális kérdéssablon.

Context: az Excel 30 checklist pontot tartalmaz, a PDF 21 fő témát és becslési/döntési blokkokat.

Acceptance criteria:

- A 30 Excel checklist pont elérhető az appban.
- A PDF fő szekciói és hintjei megjelennek logikus csoportosításban.
- A kérdésekhez státusz, felelős, határidő, válasz, nyitott kérdés és következő lépés rögzíthető.

Verify:

- Nyiss meg egy új projektet, és ellenőrizd, hogy a checklist témák és kérdések megjelennek.

### 4. Projektlista és projekt műveletek

Goal: a meglévő projektek táblában kezelhetők legyenek.

Context: létrehozni csak a főmenüből lehet, listából nézni, szerkeszteni és archiválni lehet.

Acceptance criteria:

- A lista tartalmazza a kért oszlopokat.
- Projekt megnyitható read-only módban.
- Read-only módból szerkesztés módba lehet váltani.
- Lista nézetből közvetlenül szerkesztés módba lehet lépni.
- Archiválás után a projekt eltűnik az aktív listából.

Verify:

- Hozz létre projektet, módosítsd, nézd meg, szerkeszd, archiváld.

### 5. Archívum és végleges törlés

Goal: archivált projektek elkülönülten kezelhetők legyenek.

Context: törlés csak archívumból történhet, és végleges.

Acceptance criteria:

- Az archívum csak archivált projekteket mutat.
- Re-open után a projekt visszakerül az aktív listába.
- Delete után a projekt nem állítható vissza.
- Delete előtt megerősítést kér az app.

Verify:

- Archiválj projektet, reopen, majd újra archiválás után delete.

### 6. Automatikus kitöltöttség és döntési összefoglaló

Goal: az Excel döntési logikája alapján automatikus állapotértékelés készüljön.

Context: a kitöltöttség nem kézi mező, hanem a checklistből számolt állapot.

Acceptance criteria:

- A kitöltöttségi százalék automatikusan változik.
- A kitöltöttségi állapot Kész, Folyamatban vagy Pontosítás szükséges.
- Az app jelzi a becslést blokkoló hiányokat.
- Az app jelzi, hogy becslés adható-e és fejlesztés indítható-e.

Verify:

- Állíts checklist pontokat Kész/Nincs meg/Részben megvan/Nem releváns állapotokra, és ellenőrizd a számított eredményt.

### 7. PDF és Excel export

Goal: projektadatok exportálhatók legyenek PDF-be és Excelbe.

Context: export kézzel indul, és az app saját mappájában tárolódik.

Acceptance criteria:

- Egy projekt exportálható PDF-be.
- Egy projekt exportálható Excelbe.
- Export fájl az alkalmazás mappájában vagy konfigurált export almappában jön létre.
- Export tartalmazza az alapadatokat, checklist válaszokat, nyitott kérdéseket és döntési összefoglalót.

Verify:

- Exportálj egy kitöltött projektet PDF-be és Excelbe, majd nyisd meg a fájlokat.

## Nyitott döntési pontok

### 1. MVP technológia

- A. Tauri + SQLite: kisebb, modernebb desktop app, jó helyi fájlkezelés.
- B. Electron + SQLite: nagyobb, de sok érett könyvtár és egyszerűbb webes fejlesztési élmény.
- C. PWA + IndexedDB: mobilon kényelmesebb, de desktop fájl/export kezelésben több kompromisszum lehet.

### 2. Mobil támogatás mélysége

- A. Reszponzív desktop app: mobilon használható, de nem natív mobil telepítés.
- B. PWA mobil telepíthetőség: telefonon app-szerű használat, böngészős korlátokkal.
- C. Későbbi natív mobil app: MVP-ben desktop, mobil külön fázis.

### 3. Export forma

- A. Excel-szerű export: a meglévő XLSM logikához hasonló munkalapok.
- B. Vezetői PDF export: tömör döntési anyag, nem teljes adatdump.
- C. Mindkettő két szinten: teljes export és rövid döntési export.

## Következő javasolt lépés

Először egy kattintható MVP prototípust érdemes készíteni mintaadatokkal és helyi mentéssel. Ez validálja a képernyőket, a workflow-t és az automatikus mentési élményt, mielőtt mélyebbre megyünk az export és a végleges adattárolás részleteiben.
