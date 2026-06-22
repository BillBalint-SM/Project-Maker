# Testing Checkpoints

## Automated checkpoint

Minden nagyobb módosítás után futtatandó:

```powershell
pnpm checkpoint
```

Ez lefuttatja:

- TypeScript ellenőrzés: `pnpm typecheck`
- Unit és UI integration tesztek: `pnpm test`
- Production frontend build: `pnpm build`

## Lefedési cél

- Főmenü screen: új projekt és meglévő projektek navigáció.
- Meglévő projektek screen: keresés, szűrők, kijelölés, PDF/Excel export, megtekintés, szerkesztés, archiválás.
- Archívum screen: aktív listára visszalépés, újra aktiválás, végleges törlés.
- Projekt detail screen: view/edit váltás, PDF/Excel export, archiválás.
- Detail tabok: Cockpit, Interjú, Alapadatok, Checklist, Nyitott kérdések, Döntés.
- Domain funkciók: draft létrehozás, readiness/Decision Score számítás, follow-up generálás.
- Storage funkciók: save, list, get, archive, reopen, delete local adapteren keresztül.
- Export funkciók: presetenként egységes export plan PDF/Excel adapterekhez.

## Manuális release smoke

Telepítő build előtt ajánlott:

1. `pnpm checkpoint`
2. `pnpm tauri:build`
3. Telepítő indítása egy tiszta mappába.
4. Új projekt létrehozása, mező módosítása, app bezárása/újranyitása.
5. Projekt megtekintése, PDF és Excel export ellenőrzése az `exports/` mappában.
6. Archiválás, újraaktiválás, végleges törlés ellenőrzése.
