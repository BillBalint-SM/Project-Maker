# Phase 2: Felmérési flow és coaching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 2-Felmérési flow és coaching
**Areas discussed:** Playbook-struktúra és pontozás, Egységes interjú+checklist UX, Coaching-tartalom szerzősége, Szabad navigáció és haladás-modell

---

## Playbook-struktúra és pontozás

| Option | Description | Selected |
|--------|-------------|----------|
| Csak 1: Általános | A meglévő 30 tételes checklist válik az egyetlen playbookká; a UI/adatmodell felkészített többre | ✓ |
| Több playbook indulláskor | Legalább 2-3 projekt-típus-specifikus playbook készül a Phase 2 végére | |

**User's choice:** Csak 1: Általános

| Option | Description | Selected |
|--------|-------------|----------|
| Playbook = tétel-lista + súlyok | Minden playbook saját tétel-listát és saját súly-konfigurációt definiál | ✓ |
| Közös 30 tétel, csak a súlyok változnak | Minden playbook ugyanazt a 30 tételt használja, csak a súly-képlet tér el | |

**User's choice:** Playbook = tétel-lista + súlyok

| Option | Description | Selected |
|--------|-------------|----------|
| Projekt létrehozásakor, változtathatatlan utólag | A playbook a létrehozási lépés része, utólag nem módosítható | ✓ |
| Utólag is módosítható | A playbook bármikor megváltoztatható a projekt élettartama alatt | |

**User's choice:** Projekt létrehozásakor, változtathatatlan utólag

| Option | Description | Selected |
|--------|-------------|----------|
| Ugyanaz a képlet, playbookból jövő súlyokkal | A meglévő calculateReadinessPercent/calculateDecisionScore struktúra megmarad, csak a súlyok paraméterezettek | ✓ |
| Érdemes újragondolni a képletet | Vita a pontozási logika hiányosságairól/javításáról is | |

**User's choice:** Ugyanaz a képlet, playbookból jövő súlyokkal

---

## Egységes interjú+checklist UX

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist-alapú, mind a 30 tétel látható/kibontható | Kibontható kártya-lista, coaching a kártyán belül | ✓ |
| Interjú-alapú, lépésenként egy tétel fókuszban | Egy kérdés teljes képernyőn, Előre/Vissza navigáció | |

**User's choice:** Checklist-alapú, mind a 30 tétel látható/kibontható

| Option | Description | Selected |
|--------|-------------|----------|
| Mindig látható kibontáskor | A coaching 4 rovata automatikusan megjelenik | ✓ |
| Külön gombbal/ikonnal előhívható | A coaching alapból elrejtve, "?" gombra jelenik meg | |

**User's choice:** Mindig látható kibontáskor

| Option | Description | Selected |
|--------|-------------|----------|
| Marad külön nézet/tab | A Cockpit és Decision külön marad az egységes checklist-től | ✓ |
| Mindent egy nézetbe olvasztani | A cockpit-áttekintés és döntés-rögzítés is beépül az egységes nézetbe | |

**User's choice:** Marad külön nézet/tab

| Option | Description | Selected |
|--------|-------------|----------|
| Igen, megőrizzük | A Cockpit gap-listája kattintható marad, ugrás+kibontás a checklistben | ✓ |
| Nem szükséges most | A gap-navigációs automatika elmarad ebben a fázisban | |

**User's choice:** Igen, megőrizzük

---

## Coaching-tartalom szerzősége

| Option | Description | Selected |
|--------|-------------|----------|
| Claude írja meg draftként, te finítod | PM/PO discovery best practice alapján Claude megfogalmazza mind a 120 blokkot | ✓ |
| Te adod meg a tartalmat vagy vázlatot | Meglévő anyag behozatala referenciaként vagy kész szövegként | |

**User's choice:** Claude írja meg draftként, te finítod

| Option | Description | Selected |
|--------|-------------|----------|
| Rövid, pásztázható (1-2 mondat / rovat) | Gyors átfutásra optimalizált, felmérés közbeni olvasásra | ✓ |
| Részletesebb, oktató jellegű bekezdés | 2-4 mondatos, alaposabb magyarázat rovatonként | |

**User's choice:** Rövid, pásztázható (1-2 mondat / rovat)

| Option | Description | Selected |
|--------|-------------|----------|
| Külön TS/JSON adatfájl, checklist-tétel ID-hoz kötve | Külön a checklist-tétel definíciótól, könnyen verziózható | ✓ |
| Beépítve a checklist-tétel (playbook) definícióba | A coaching 4 mező a playbook-tétel objektum része (mint a legacy "hint" mező) | |

**User's choice:** Külön TS/JSON adatfájl, checklist-tétel ID-hoz kötve

| Option | Description | Selected |
|--------|-------------|----------|
| Mind a 30 tételre | Minden tételnek legyen coaching-panelja már a Phase 2 végén | ✓ |
| Csak a kritikus/MVP-tételek (kb. 20-22 db) | A kevésbé fontos tételek coaching-tartalma későbbi iterációban készül | |

**User's choice:** Mind a 30 tételre

---

## Szabad navigáció és haladás-modell

| Option | Description | Selected |
|--------|-------------|----------|
| Beépül az adott checklist-tételbe | A follow-up kérdés(ek) a tétel kibontott kártyáján belül jelennek meg | ✓ |
| Marad külön nézet | A follow-up kérdések külön listában/nézetben élnek | |

**User's choice:** Beépül az adott checklist-tételbe

| Option | Description | Selected |
|--------|-------------|----------|
| Tételek sorrendben (kategória szerint), de szabadon ugorható | Definiált kategória-sorrend, de bármelyik tételre ugorható | ✓ |
| Dinamikus, "következő ajánlott tétel" jelzéssel | A rendszer aktívan javasolja a következő kitöltendő tételt | |

**User's choice:** Tételek sorrendben (kategória szerint), de szabadon ugorható

| Option | Description | Selected |
|--------|-------------|----------|
| Csak az első (vagy első hiányzó) tétel | A legacy new Set([1]) mintája szerint, "első hiányzó tételre" általánosítva | ✓ |
| Minden tétel nyitva alapból | Az összes tétel kibontva látszik belépéskor | |

**User's choice:** Csak az első (vagy első hiányzó) tétel

| Option | Description | Selected |
|--------|-------------|----------|
| Igen, megőrizzük | "Mind kinyitása / mind becsukása" gomb marad | ✓ |
| Nem szükséges most | Elhagyjuk ezt a vezérlőt ebben a fázisban | |

**User's choice:** Igen, megőrizzük

---

## Claude's Discretion

- A pontos playbook-adatstruktúra (TypeScript interfész alakja, fájl-elhelyezés a hexagonális rétegekben)
- A coaching-tartalom adatfájl pontos sémája
- A checklist-kártya komponens konkrét belső felépítése
- A 30 coaching-tartalom blokk konkrét szövegezése (Claude draft, felhasználó utólag felülvizsgálja)

## Deferred Ideas

- További (projekt-típus-specifikus) playbookok — későbbi iteráció
- Playbook utólagos módosítása egy már létrehozott projekten — jövőbeli fázis, ha felmerül az igény
- Dinamikus "következő ajánlott tétel" jelzés a checklist-navigációban — a Cockpit gap-listája tölti be ezt a szerepet jelenleg
