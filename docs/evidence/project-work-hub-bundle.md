# Project Work Hub – initial bundle evidence

Mérés dátuma: 2026. 08. 19.

Parancs:

```text
npx --yes pnpm@11.20.0 --filter @project-maker/web exec ng build --configuration production --stats-json
```

Eredmény:

| Kezdeti fájl | Nyers méret | Becsült átvitt méret |
| --- | ---: | ---: |
| `main-WB3M5QAK.js` | 422,36 kB | 112,59 kB |
| `styles-IZIOFJGU.css` | 1,66 kB | 642 byte |
| **Kezdeti csomag összesen** | **424,02 kB** | **113,23 kB** |

Az eredeti warning budget változatlanul **500 kB**. A mért kezdeti csomag 75,98 kB-tal a limit alatt marad. A build sikeresen befejeződött, budget-figyelmeztetés nélkül, és létrehozta az elemzéshez használható `apps/web/dist/web/stats.json` fájlt.
