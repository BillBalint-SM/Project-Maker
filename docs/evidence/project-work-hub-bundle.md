# Project Work Hub – initial bundle evidence

Mérés dátuma: 2026. 08. 19.

Parancs:

```text
npx --yes pnpm@11.20.0 --filter @project-maker/web exec ng build --configuration production --stats-json
```

Eredmény:

| Kezdeti fájl | Nyers méret | Becsült átvitt méret |
| --- | ---: | ---: |
| `main-HBBDVZ65.js` | 422,35 kB | 112,49 kB |
| `styles-IZIOFJGU.css` | 1,66 kB | 642 byte |
| **Kezdeti csomag összesen** | **424,01 kB** | **113,13 kB** |

Az eredeti warning budget változatlanul **500 kB**. A mért kezdeti csomag 75,99 kB-tal a limit alatt marad. A build sikeresen befejeződött, budget-figyelmeztetés nélkül, és létrehozta az elemzéshez használható `apps/web/dist/web/stats.json` fájlt.
