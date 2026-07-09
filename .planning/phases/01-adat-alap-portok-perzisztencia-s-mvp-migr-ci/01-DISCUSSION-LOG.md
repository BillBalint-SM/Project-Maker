# Phase 1: Adat-alap, portok, perzisztencia és MVP-migráció - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 01-adat-alap-portok-perzisztencia-s-mvp-migr-ci
**Areas discussed:** Legacy migráció hatóköre, Walking Skeleton UI, Backup/restore UX, Local actor-azonosító

---

## Legacy migráció (MIG-01) hatóköre

| Option | Description | Selected |
|--------|-------------|----------|
| Export gomb a régi appban | Új Rust command + "Export JSON" gomb a Tauri appban, webes import fájl-feltöltéssel | |
| Közvetlen DB-kiolvasás | Egyszeri migrációs szkript, ami közvetlenül olvassa a régi SQLite fájlt | |
| Nem szükséges most | Csak a formátum/import-logika épül meg, valósághű fixtúrán tesztelve | ✓ |

**User's choice:** Nem szükséges most
**Notes:** Nincs még éles felhasználói adat — a migrációt szintetikus fixtúrán teszteljük, élő UX/export a régi appban nem prioritás ebben a fázisban.

---

## Walking Skeleton — minimális proof-of-life UI

| Option | Description | Selected |
|--------|-------------|----------|
| Projekt-lista nézet | Lista az IndexedDB-ből — bizonyítja olvasást/írást és routingot | ✓ |
| Üres "projekt létrehozása" form | Minimális form, ami ír egy üres projekt-rekordot | |
| Fejlesztői diagnosztika oldal | /debug oldal az envelope-mezőkkel és séma-verzióval | |

**User's choice:** Projekt-lista nézet
**Notes:** Ez a Walking Skeleton gate (MVP mód + Phase 1 + új projekt) kötelező minimális UI-bizonyítéka — nem a valódi felmérő UI (az Phase 2-ben készül).

---

## Backup/restore UX (DATA-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Egyszerű export/import gomb | Valódi UI-gomb: JSON letöltés böngészőn keresztül + fájl-feltöltéses visszaállítás | ✓ |
| Csak API/parancssor szinten | Csak belső export/import függvény, UI-gomb nélkül | |

**User's choice:** Egyszerű export/import gomb
**Notes:** A felhasználó explicit, látható UI-t akar már ebben a fázisban, nem csak belső logikát.

---

## Local actor-azonosító (PREP-02 előkészítés)

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded helyi azonosító | Fix "local-user" stub az envelope `updated_by` mezőjében | ✓ |
| Nincs azonosító most | `updated_by` üresen/null marad a sync-mérföldkőig | |

**User's choice:** Hardcoded helyi azonosító
**Notes:** Előkészíti a syncet anélkül, hogy valódi felhasználó-fogalmat vagy bejelentkezési UI-t igényelne.

---

## Claude's Discretion

- Konkrét RxDB/Dexie séma-definíció, Zod-séma pontos alakja, port-interfészek TypeScript signature-jei — a kutatás (STACK.md, ARCHITECTURE.md) HIGH konfidenciával lezárta, a planner ez alapján dolgozik.
- A projekt-lista nézet pontos vizuális megjelenése (ideiglenes proof-of-life, nem végleges UI).

## Deferred Ideas

- Élő migrációs UX / export gomb a régi Tauri appban — csak valódi éles adat esetén releváns.
- Valódi felhasználó-fogalom / bejelentkezés — a sync-mérföldkővel érkezik (v2, SYNC-01..03).
