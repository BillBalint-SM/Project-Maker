# Project Maker Context

## Termék célja

Project Maker egy belső MVP projektindítási felmérésekhez. A felhasználó PM, PO vagy BA szerepben strukturáltan rögzíti a projekt alapadatait, üzleti célját, nyitott kérdéseit és readiness állapotát.

Az app nem általános projektmenedzsment rendszer. A fő értéke az intake, a becsülhetőség és a döntési előkészítés.

## Fő workflow

1. Főmenüben új projekt indítása vagy meglévő projektek megnyitása.
2. Új projekt azonnal draftként mentődik.
3. A felhasználó kitölti az alapadatokat, checklist pontokat és follow-up kérdéseket.
4. Az app automatikusan readiness állapotot, Decision Score-t és javasolt következő lépést számol.
5. Megtekintés módban vagy lista kijelölésből PDF/Excel export készíthető.
6. Projekt archiválható, az archívumból újranyitható vagy végleg törölhető.

## Domain fogalmak

- Intake: az első strukturált felmérés, amely alapján eldől, hogy a projekt becsülhető vagy fejlesztésre vihető-e.
- Readiness: automatikus készültségi mutató a kötelező és fontos adatok alapján.
- Decision Score: egyszerű döntéstámogató pontszám üzleti érték, stratégiai illeszkedés, sürgősség, confidence, komplexitás, kockázat és readiness alapján.
- Hiánylista: azok az információk, amelyek blokkolják vagy gyengítik a becslést/döntést.
- Follow-up: nyitott kérdés, amelynek felelőse, határideje, státusza és döntési eredménye lehet.
- Archívum: nem aktív projektek listája. Innen a törlés végleges.

## Architekturális kiindulás

- Offline-first desktop MVP.
- Egyfelhasználós működés az első cél, de a domain és export logika később backend felé mozgatható.
- A React UI feature modulokra van bontva: app shell, projektlista, projektrészletek, export preset, közös UI komponensek.
- A Rust/Tauri réteg fájlmentést és SQLite parancsokat ad.
- A böngészős localStorage fallback fejlesztői és diagnosztikai biztonsági háló.

## Későbbi bővítési irány

A nagyobb, többfelhasználós irány web/PWA alapú lehet Microsoft Entra ID auth-tal, backend API-val, PostgreSQL/Azure adattárolással, Blob Storage exporttal és Application Insights naplózással. Ennek részletesebb üzleti és technikai vázlata a `future_scaling.md` fájlban van.
