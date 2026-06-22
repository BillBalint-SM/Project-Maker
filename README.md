# Project Maker

Project Maker egy offline-first projektindítási és intake alkalmazás PM/PO munkához. Az MVP célja, hogy egy új projekt felmérése közben automatikusan mentse a válaszokat, readiness állapotot számoljon, döntési javaslatot adjon, majd PDF vagy Excel exportot készítsen.

## Letöltés

Windows telepítő a GitHub Releases oldalon érhető el:

[Project Maker letöltése](https://github.com/BillBalint-SM/Project-Maker/releases/latest)

A letöltéshez a `Project.Maker_..._x64-setup.exe` fájlt kell választani. A telepítő Windows x64 gépre készült.

Biztonsági megjegyzés: a jelenlegi MVP installer még nincs kódtanúsítvánnyal aláírva. Szélesebb körű terjesztés előtt Windows code signing szükséges; a signing és SmartScreen terv a `docs/windows-code-signing.md` fájlban található.

## Funkciók

- Új projekt azonnali draftként jön létre, automata mentéssel.
- Meglévő és archivált projektek külön listában kezelhetők.
- Projekt részletek: alapadatok, felelősök, checklist, follow-up kérdések, döntési blokk.
- Readiness MVP és egyszerű Decision Score.
- Vezetett interjú mód gyors vagy teljes felméréssel.
- PDF és Excel export vezetői, teljes vagy hiánylista preset alapján.
- Lokális SQLite adattárolás Tauri appban, böngészős fallback localStorage-gal.

## Tech stack

- Frontend: React + TypeScript + Vite
- Desktop runtime: Tauri 2
- Natív réteg: Rust
- Adattárolás: SQLite a telepített alkalmazás mappája alatti `data/project-maker.db` fájlban
- Export: `jspdf`, `jspdf-autotable`, `xlsx`

## Fejlesztői indítás

```powershell
pnpm install
pnpm tauri:dev
```

Csak frontend futtatáshoz:

```powershell
pnpm dev
```

## Ellenőrzés és build

```powershell
pnpm typecheck
pnpm test
pnpm checkpoint
pnpm build
pnpm tauri:build
```

A `pnpm checkpoint` a napi fejlesztői visszaellenőrzés: TypeScript ellenőrzés, unit/UI integration tesztek és production frontend build egyben.

A Windows telepítő a Tauri build után itt jön létre:

```text
src-tauri/target/release/bundle/nsis/
```

## Lokális adatok és exportok

Telepített appban az adatok az alkalmazás futtatási mappájához képest kerülnek mentésre:

- Adatbázis: `data/project-maker.db`
- Exportok: `exports/`

Fejlesztői böngészős futásnál SQLite helyett localStorage fallback aktív.

## Dokumentáció

- Termék és domain kontextus: `CONTEXT.md`
- Skálázási irány: `future_scaling.md`
- Refactor design: `docs/codebase-architecture-refactor/design.md`
- Felhasználói útmutató: `docs/project-maker-user-guide.html`
- Architekturális döntések: `docs/adr/`
- Windows code signing terv: `docs/windows-code-signing.md`

## Repo hygiene

Build artifactok, lokális adatbázisok, release csomagok és környezeti fájlok nincsenek verziózva. A cél, hogy a repo forráskódot, dokumentációt és reprodukálható build konfigurációt tartalmazzon.
