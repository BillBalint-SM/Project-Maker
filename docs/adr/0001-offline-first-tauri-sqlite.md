# ADR 0001: Offline-first Tauri + SQLite MVP

## Státusz

Elfogadva MVP baseline-ként.

## Kontextus

Az első verzió célja egy belső, egyfelhasználós PM/PO intake eszköz. A felhasználónak offline is tudnia kell projektet létrehozni, szerkeszteni, archiválni és exportálni. A programot telepíthető Windows alkalmazásként kell tudni átadni.

Későbbi irányként nyitva kell hagyni a többfelhasználós, Entra ID alapú webes skálázást.

## Döntés

Az MVP Tauri 2 desktop appként készül React + TypeScript frontenddel, Rust natív réteggel és lokális SQLite adattárolással.

Az adatbázis a telepített app futtatási mappája alatt jön létre:

```text
data/project-maker.db
```

Az exportok ugyanitt, külön mappában készülnek:

```text
exports/
```

Böngészős fejlesztői futásnál localStorage fallback használható.

## Következmények

- Jó offline működés és egyszerű MVP terjesztés.
- Nincs szükség szerverre, tenant konfigurációra vagy auth integrációra az első verzióhoz.
- A lokális adat a felhasználó gépén marad.
- Több gép vagy több felhasználó közötti szinkron nincs megoldva az MVP-ben.
- Későbbi webes skálázáskor a domain logika és exportterv részben újrahasznosítható, de az adattárolási és auth réteg cserélendő.

## Alternatívák

- Csak web app: egyszerűbb frissítés, de gyengébb offline és nagyobb infrastruktúra igény.
- Electron app: hasonló desktop képességek, de nagyobb runtime és csomagméret.
- Központi backend már MVP-ben: skálázhatóbb, de túl nagy induló komplexitás a belső validációhoz.
