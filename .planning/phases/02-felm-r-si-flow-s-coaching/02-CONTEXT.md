# Phase 2: Felmérési flow és coaching - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Ez a fázis szállítja a felhasználó számára látható, valódi felmérési élményt: projekt-CRUD (létrehozás, listázás, archiválás, törlés), egy egységes, checklist-alapú guided felmérési felület (nem külön interjú-tab), kérdésenkénti coaching-panel (négy rovat: miért/mit/hogyan/etikett), playbook-választás (induláskor 1 playbook, de a modell többre felkészített), és a playbook súlyaiból számolt readiness/döntési pontszám. A Phase 1 Walking Skeleton proof-of-life UI-ja (`ProjectListView`) itt válik a valódi, teljes funkciójú projekt-lista+felmérés élménnyé.

</domain>

<decisions>
## Implementation Decisions

### Playbook-struktúra és pontozás
- **D-01:** A Phase 2 végén EGY playbook létezik ("Általános" — a jelenlegi legacy 30 tételes checklist tartalma), de a playbook-választás UI-ja és adatmodellje már többre felkészített (SURVEY-04 szerint). Projekt-típus-specifikus további playbookok később, valós felhasználói visszajelzés alapján.
- **D-02:** A playbook adatmodellje SAJÁT tétel-listát ÉS saját súly-konfigurációt definiál (nem csak súlyokat egy közös tétel-listához) — rugalmasabb jövőre nézve, egy jövőbeli "Belső IT" playbook más tételeket is tartalmazhat majd.
- **D-03:** A playbook a projekt létrehozásakor kerül kiválasztásra, és utólag NEM módosítható (playbook-váltás újraszámolást és adatvesztést jelentene — ez explicit nem-cél ebben a fázisban).
- **D-04:** A readiness/decision score számítás (`calculateReadinessPercent`/`calculateDecisionScore` mintája a legacy `project.ts`-ből) képlet-struktúrája megmarad, csak a súly-értékek jönnek a kiválasztott playbookból kódba-égetés helyett.

### Egységes interjú+checklist UX
- **D-05:** Az alap UX-paradigma checklist-alapú: mind a 30 (playbook-)tétel egy kibontható kártya-listában jelenik meg, szabadon navigálható sorrendben. NEM külön lépés-lánc interjú-mód (a legacy `InterviewTab` mintája nem folytatódik önálló nézetként).
- **D-06:** A coaching-panel (4 rovat) automatikusan látható, amint egy tétel ki van bontva — nincs külön "segítség" gomb/kattintás.
- **D-07:** A Cockpit (áttekintés + hiányosság-lista) és a Decision (végső Go/No-Go döntés rögzítése) KÜLÖN nézet/tab marad — a SURVEY-05 egyesítés csak az interjú+checklistre vonatkozik, ezek más célt szolgálnak.
- **D-08:** A legacy `fixGap` minta megmarad: a Cockpit gap-listájában egy elemre kattintva a checklist-nézetre vált, kibontja és odagörget a megfelelő tételre.

### Coaching-tartalom szerzősége
- **D-09:** Claude írja meg a teljes coaching-tartalmat (mind a 30 tételre × 4 rovat ≈ 120 szövegblokk) PM/PO discovery best practice-ek alapján, magyarul; a felhasználó utólag átnézi és finomítja. Nincs meglévő forrásanyag, amit be kellene hozni.
- **D-10:** A coaching-rovatok rövidek és pásztázhatók (1-2 mondat/rovat) — a felmérés KÖZBEN olvasandók, nem tréning-anyagként; nem hosszú, oktató jellegű bekezdések.
- **D-11:** A coaching-tartalom külön TS/JSON adatfájlban tárolódik, checklist-tétel ID-hoz kötve (pl. `src/domain/content/coachingContent.ts`), NEM a checklist-tétel/playbook definíció része (szemben a legacy `hint` mezővel) — könnyebben verziózható és később playbookonként szétválasztható.
- **D-12:** Mind a 30 tételre készül coaching-tartalom a Phase 2 végére — nincs részleges (csak kritikus/MVP-tételekre szűkített) lefedettség.

### Szabad navigáció és haladás-modell
- **D-13:** A follow-up kérdések (legacy `FollowUpQuestion`, `sourceChecklistItemId` mezővel) az adott checklist-tétel kibontott kártyáján BELÜL jelennek meg — nincs külön "Follow-ups" nézet/tab.
- **D-14:** A tételek a jelenlegi kategória-sorrendben jelennek meg (Üzleti cél → Sikerkritérium → ... → Dokumentáció), de a felhasználó bármelyik tételre szabadon ugorhat/kattinthat — nincs kényszerített lépés-lánc, és nincs dinamikus "következő ajánlott tétel" jelzés sem (ez a Cockpit gap-listájának feladata marad, D-08 szerint).
- **D-15:** Belépéskor alapértelmezésben csak az első (vagy folytatáskor az első kitöltetlen) tétel van kibontva, a többi összecsukva — a legacy `new Set([1])` mintája szerint, de "első hiányzó tételre" általánosítva.
- **D-16:** A "mind kinyitása / mind becsukása" vezérlő (legacy `setAllChecklistItems` minta) megmarad az új egységes felületen is.

### Claude's Discretion
- A pontos playbook-adatstruktúra (TypeScript interfész alakja, fájl-elhelyezés a hexagonális rétegekben), a coaching-tartalom adatfájl pontos sémája, és a checklist-kártya komponens konkrét belső felépítése — a kutatás/tervezés dolgozza ki, a fenti döntések alapján.
- A 30 coaching-tartalom blokk konkrét szövegezése (Claude draft, D-09 szerint) — nem kérdezendő újra kérdésenként, a tervező/végrehajtó dolgozza ki PM/PO best practice alapon, majd a felhasználó felülvizsgálja végrehajtás után.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements és korábbi fázis kontextus
- `.planning/REQUIREMENTS.md` — SURVEY-01..07, COACH-01..03 pontos megfogalmazása
- `.planning/ROADMAP.md` — Phase 2 Success Criteria és Depends on: Phase 1
- `.planning/phases/01-adat-alap-portok-perzisztencia-s-mvp-migr-ci/01-CONTEXT.md` — a domain-modell (Envelope, checklistAnswers, followUps, completion) lezárt alakja
- `.planning/phases/01-adat-alap-portok-perzisztencia-s-mvp-migr-ci/SKELETON.md` — Walking Skeleton architektúra (RxDB, StoragePort, hexagonális rétegek), amire ez a fázis épül
- `.planning/phases/01-adat-alap-portok-perzisztencia-s-mvp-migr-ci/01-01-SUMMARY.md` — ProjectListView jelenlegi állapota, container.ts/StoragePort API, amit ez a fázis kiterjeszt

### Projekt-szintű kutatás
- `.planning/research/SUMMARY.md` — explicit megjegyzi: "Phase 3-4 (coaching + heurisztika): a determinisztikus coaching/minőség-heurisztika konkrét mintái MEDIUM confidence — kevés direkt precedens" — ez Phase 2 coaching-részére is vonatkozik, fázis-szintű kutatás (`/gsd-plan-phase 2`) valószínűleg hasznos lesz
- `.planning/research/ARCHITECTURE.md` — Domain mag / ContentPort tervezett szerepe (a coaching-tartalom `ContentPort` mögé kerülhet, ha a Phase 1-ben létrehozott port-interfészhez illesztjük)

### Legacy referencia (NEM szó szerinti migráció, hanem mintaforrás)
- `src/data/checklist.ts` — a jelenlegi 30 tételes `checklistTemplate`, ez válik az "Általános" playbook tartalmává
- `src/data/types.ts` — `ChecklistTemplateItem` típus alakja (referencia a playbook-tétel struktúrához)
- `src/lib/project.ts` — `calculateReadinessPercent`, `calculateDecisionScore`, `calculateCompletion`, `collectReadinessGaps` — a pontozási logika, playbook-súlyokkal paraméterezendő (D-04)
- `src/features/project-detail/ProjectDetailView.tsx` és `tabs/*` — a legacy 6 lapos szerkezet (cockpit/interview/overview/checklist/followups/decision); az interview+checklist egyesül (D-05), a cockpit+decision külön marad (D-07), a followups beépül (D-13)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `checklistTemplate` (`src/data/checklist.ts`) — 30 tétel teljes tartalma (kategória, controlPoint, exampleQuestion, hint) közvetlenül átvehető az "Általános" playbook tartalmaként
- `calculateReadinessPercent`/`calculateDecisionScore`/`calculateCompletion` (`src/lib/project.ts`) — bizonyított pontozási logika, playbook-súlyokkal paraméterezve újrafelhasználható
- `collectReadinessGaps` + `fixGap` minta (`ProjectDetailView.tsx`) — gap-alapú navigáció, megőrzendő (D-08)
- Phase 1 `StoragePort`/`RxdbStorageAdapter`/`container.ts` — a perzisztencia-réteg már kész, ez a fázis csak a domain-modellt (playbook, coaching) és a UI-t bővíti rá

### Established Patterns
- Hexagonális réteg-szerkezet (`domain/model`, `domain/ports`, `adapters/`, `app/`, `features/`) — Phase 1-ben lefektetve, ezt a fázist is követnie kell
- `Envelope<T>` + Zod validáció minden storage-művelet előtt — a playbook és coaching-tartalom adatoknak is validálódnia kell, ha perzisztálva vannak (vagy statikus adatfájlként szállítva, ha nem projektenkénti adat)
- React Router 7 routing (`main.tsx`) — a felmérési nézet ide illeszkedik útvonalként

### Integration Points
- `ProjectListView.tsx` — innen navigál majd a felhasználó egy projekt megnyitásakor az új felmérési nézetre
- `app/container.ts` — ha a coaching-tartalom `ContentPort` mögé kerül (Claude's Discretion), itt kell bekötni

</code_context>

<specifics>
## Specific Ideas

- A checklist-kártyák sorrendje kövesse a jelenlegi kategória-sorrendet (Üzleti cél elsőként, Dokumentáció utolsóként) — ez már bevált, jól átgondolt sorrend.
- A coaching-tartalom hangneme legyen tömör és gyakorlatias, nem akadémikus — a felhasználó munka közben olvassa, nem tanulmányként.

[Nincs más — a beszélgetés a fázis hatókörén belül maradt.]

</specifics>

<deferred>
## Deferred Ideas

- További (projekt-típus-specifikus) playbookok — későbbi iteráció, valós felhasználói visszajelzés alapján (D-01).
- Playbook utólagos módosítása egy már létrehozott projekten — jövőbeli fázis, ha felmerül az igény (D-03).
- Dinamikus "következő ajánlott tétel" jelzés a checklist-navigációban — jelenleg a Cockpit gap-listája tölti be ezt a szerepet (D-14).
- Csak kritikus/MVP-tételekre szűkített coaching-lefedettség — elvetve, mind a 30 tételre készül tartalom (D-12), így ez nem is halasztott elem, hanem eldöntött kérdés.

</deferred>

---

*Phase: 02-felmérési-flow-és-coaching*
*Context gathered: 2026-07-09*
