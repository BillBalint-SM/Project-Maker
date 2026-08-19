# Project Work Hub – validációs bizonyíték

Validálás dátuma: 2026. 08. 19.

Környezet: Node.js 26.7.0, pnpm 11.20.0 és külön, helyi, eldobható PostgreSQL tesztadatbázisok. A parancsokban használt kapcsolat helyén szándékosan csak semleges helyőrző szerepel.

## Repository-szintű ellenőrzés

```powershell
$env:DATABASE_URL='<localhost disposable test database>'
npx --yes pnpm@11.20.0 --filter @project-maker/api migration:run
npx --yes pnpm@11.20.0 verify
```

Eredmény: sikeres.

- COMM határvédelem: 17 production fájl és 5 aktuális dokumentum ellenőrizve.
- UI-szöveg inventory: 941 forrástétel, eltérés nélkül; az interpolált technikai útvonalakat, Angular stílusmetaadatokat, theme/config értékeket és futásidejű diagnosztikai azonosítókat a generátor kizárja.
- Operációs tesztek: 5/5 sikeres.
- Contracts tesztek: 18/18 sikeres.
- Angular tesztek: 68/68 sikeres.
- API tesztek: 228/228 sikeres.
- Minden workspace typecheck és build sikeres.
- A production build budget-figyelmeztetés nélkül fejeződött be. A részletes méretadatokat a [bundle-bizonyíték](project-work-hub-bundle.md) rögzíti.

## Valós böngészős ellenőrzés

```powershell
$env:DATABASE_URL='<localhost disposable browser-e2e database>'
npx --yes pnpm@11.20.0 --filter @project-maker/web test:e2e
```

Eredmény: 83/83 Playwright-teszt sikeres 1,8 perc alatt.

A böngészős bizonyíték lefedi a Portfolio és Aktív munkasor belépési pontokat, a Customer kommunikációt, a séma- és interjúfolyamatot, az Interjú → Felkészültség → Döntés-előkészítés → Projektállapot journey-t, a Projektbeállítások archiválási és helyreállítási útját, a pontos visszatérést, a valós Tab/Shift+Tab billentyűzetes navigációt, a kontrollált hibaállapotokat, valamint a teljes Projekt-journey 390 px széles nézetét vízszintes túlcsordulás nélkül.
