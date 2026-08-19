# Project Work Hub – UI-szövegleltár

> Generált fájl. Módosítás: `scripts/generate-ui-copy-inventory.mjs`, majd `pnpm generate:ui-copy`.

Ez a leltár a munkavállalói felületen megjelenő kanonikus navigációs neveket, címeket, állapotokat, műveleteket, mezőket, súgókat és helyreállítási szövegeket gyűjti össze. A kézzel karbantartott kanonikus szerződés mellett a generátor a teljes alkalmazássablon statikus szövegeit és a TypeScriptből származó magyar futásidejű visszajelzéseket is felsorolja. A kapcsos zárójel dinamikus üzleti adatot jelöl. A technikai azonosítók és a felhasználó által megadott projektadatok nem copy-elemek.

| Képernyő | Kontextus | Javasolt kanonikus szöveg | Forrás |
| --- | --- | --- | --- |
| Alkalmazáskeret | Navigáció | Áttekintő | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Új projekt | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Folyamatban lévő ügyek | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Utánkövetések | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Markdown beállítások | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Kérdésbank beállítások | Kanonikus szerződés |
| Alkalmazáskeret | Állapot és művelet | {darab} új ügyfélválasz · Feldolgozás megnyitása | Kanonikus szerződés |
| Áttekintő | Cím | Áttekintő | Kanonikus szerződés |
| Áttekintő | Bevezető | Az aktív projektek és a következő feladatok áttekintése. | Kanonikus szerződés |
| Áttekintő | Elsődleges művelet | Folyamatban lévő ügyek | Kanonikus szerződés |
| Áttekintő | Másodlagos művelet | Új projekt | Kanonikus szerződés |
| Áttekintő | Betöltés | A projektek betöltése… | Kanonikus szerződés |
| Áttekintő | Hiba és helyreállítás | A projektek nem tölthetők be · Projektlista újratöltése | Kanonikus szerződés |
| Áttekintő | Üres állapot | Még nincs projekt · Új projekt létrehozása | Kanonikus szerződés |
| Áttekintő | Kártyamező | Következő lépés felelőse | Kanonikus szerződés |
| Áttekintő | Kártyamező | Következő lépés | Kanonikus szerződés |
| Áttekintő | Ügyfélpostafiók | Utolsó sikeres frissítés · Nem társított üzenetek · Üzenetek frissítése | Kanonikus szerződés |
| Új projekt | Cím | Új projekt | Kanonikus szerződés |
| Új projekt | Bevezető | Add meg az alapadatokat, majd indítsd el a projektfelmérést. | Kanonikus szerződés |
| Új projekt | Mező | Projekt neve | Kanonikus szerződés |
| Új projekt | Mező | Belső PO/PM neve | Kanonikus szerződés |
| Új projekt | Mező | Ügyfél kapcsolattartó neve | Kanonikus szerződés |
| Új projekt | Mező | Ügyfél kapcsolattartó e-mail-címe | Kanonikus szerződés |
| Új projekt | Elsődleges művelet | Mentés és tovább a felméréshez | Kanonikus szerződés |
| Új projekt | Másodlagos művelet | Piszkozat mentése és kilépés | Kanonikus szerződés |
| Új projekt | Kilépés | Mégse | Kanonikus szerződés |
| Folyamatban lévő ügyek | Cím | Folyamatban lévő ügyek | Kanonikus szerződés |
| Folyamatban lévő ügyek | Visszatérés | Vissza az Áttekintőre | Kanonikus szerződés |
| Folyamatban lévő ügyek | Szűrő | Projektnév · Sürgősség · Felkészültség | Kanonikus szerződés |
| Folyamatban lévő ügyek | Művelet | Lista frissítése · Szűrők törlése | Kanonikus szerződés |
| Folyamatban lévő ügyek | Betöltés | A folyamatban lévő ügyek betöltése… | Kanonikus szerződés |
| Folyamatban lévő ügyek | Hiba és helyreállítás | A folyamatban lévő ügyek nem tölthetők be · Lista újratöltése | Kanonikus szerződés |
| Folyamatban lévő ügyek | Elavult állapot | A lista elavult lehet · Sikertelen lekérés újrapróbálása | Kanonikus szerződés |
| Folyamatban lévő ügyek | Szűrt üres állapot | Nincs találat · Szűrők törlése | Kanonikus szerződés |
| Folyamatban lévő ügyek | Üres állapot | Nincs aktív projekt · Új projekt létrehozása | Kanonikus szerződés |
| Utánkövetések | Cím | Utánkövetések | Kanonikus szerződés |
| Utánkövetések | Bevezető | A nyitott tisztázási tételek az összes aktív projektből, határidő szerint rendezve. | Kanonikus szerződés |
| Utánkövetések | Betöltés | Az utánkövetések betöltése folyamatban van… | Kanonikus szerződés |
| Utánkövetések | Hiba és helyreállítás | Az utánkövetések most nem tölthetők be · Utánkövetések újratöltése | Kanonikus szerződés |
| Utánkövetések | Üres állapot | Nincs nyitott utánkövetés · Áttekintő megnyitása | Kanonikus szerződés |
| Utánkövetések | Listaelem | Projekt · Kategória · Felelős · Határidő · Következő lépés | Kanonikus szerződés |
| Utánkövetések | Elsődleges művelet | Utánkövetés megnyitása | Kanonikus szerződés |
| Projektkörnyezet | Navigáció | Projektállapot | Kanonikus szerződés |
| Projektkörnyezet | Navigáció | Felmérés | Kanonikus szerződés |
| Projektkörnyezet | Navigáció | Felkészültség | Kanonikus szerződés |
| Projektkörnyezet | Navigáció | Döntési értékelés | Kanonikus szerződés |
| Projektkörnyezet | Navigáció | Markdown terv | Kanonikus szerződés |
| Projektkörnyezet | Navigáció | Projektbeállítások | Kanonikus szerződés |
| Projektkörnyezet | Visszatérés | Vissza az Áttekintőre / a folyamatban lévő ügyekhez / az utánkövetésekhez | Kanonikus szerződés |
| Projektállapot | Cím | Projektállapot | Kanonikus szerződés |
| Projektállapot | Kártya | Projektkoordináció | Kanonikus szerződés |
| Projektállapot | Mező | Következő lépés felelőse · Következő lépés · Határidő | Kanonikus szerződés |
| Projektállapot | Művelet | Koordináció szerkesztése · Koordináció mentése | Kanonikus szerződés |
| Projektállapot | Kártya | Ügyféllevelezés · Ügyféllevelezés kezelése | Kanonikus szerződés |
| Projektállapot | Kártya | Legutóbbi aktivitás | Kanonikus szerződés |
| Projektállapot | Hiba és helyreállítás | Projektállapot újratöltése · Aktivitás újratöltése | Kanonikus szerződés |
| Felmérés | Cím | Felmérés | Kanonikus szerződés |
| Felmérés | Bevezető | Válaszd ki az aktív kérdéseket, fogadd el a kérdéssémát, majd folytasd a kezdő felmérési kört. | Kanonikus szerződés |
| Felmérés | Betöltés | A felmérési kérdések betöltése folyamatban van… | Kanonikus szerződés |
| Felmérés | Hiba és helyreállítás | A felmérési oldal nem tölthető be · Felmérési oldal újratöltése | Kanonikus szerződés |
| Felmérés | Séma | Projekt kérdésséma · Kérdésséma elfogadása és felmérés indítása | Kanonikus szerződés |
| Felmérés | Kör | Kezdő felmérési kör · Folyamatban · Felmérési kör lezárva | Kanonikus szerződés |
| Felmérés | Mentési állapot | Mentés folyamatban · Mentve · A mentés nem sikerült | Kanonikus szerződés |
| Felmérés | Elsődleges művelet | Felmérés lezárása és továbblépés | Kanonikus szerződés |
| Felmérés | Másodlagos művelet | Lezárás és ügyfélcsomag előnézete | Kanonikus szerződés |
| Felmérési összefoglaló | Cím | Ügyfélnek küldött felmérési összefoglalók | Kanonikus szerződés |
| Felmérési összefoglaló | Mező | Feladó · Címzett · Tárgy · Módosítás összefoglalása | Kanonikus szerződés |
| Felmérési összefoglaló | Művelet | Előnézet és küldés · Küldés az ügyfélnek | Kanonikus szerződés |
| Felmérési összefoglaló | Hiba és helyreállítás | A levelezőrendszer elutasította az átadást · Összefoglaló újraküldése | Kanonikus szerződés |
| Felmérési összefoglaló | Bizonytalan eredmény | Ellenőrzés után újrapróbálás | Kanonikus szerződés |
| Felkészültség | Cím | Felkészültség | Kanonikus szerződés |
| Felkészültség | Összegzés | Felmérés kitöltöttsége · Felkészültség | Kanonikus szerződés |
| Felkészültség | Tartalom | Értékelési tényezők · Rendezendő hiányok | Kanonikus szerződés |
| Felkészültség | Hiba és helyreállítás | Felkészültségi értékelés újratöltése | Kanonikus szerződés |
| Felkészültség | Üres állapot | Még nincs kezdő felmérés | Kanonikus szerződés |
| Felkészültség | Tisztázás | Tisztázási utánkövetések · Új tisztázási tétel | Kanonikus szerződés |
| Felkészültség | Tisztázási művelet | Módosítások mentése · Tétel lezárása · Forráshivatkozás törlése | Kanonikus szerződés |
| Döntési értékelés | Cím | Döntési értékelés | Kanonikus szerződés |
| Döntési értékelés | Betöltés | A döntési értékelés betöltése folyamatban van… | Kanonikus szerződés |
| Döntési értékelés | Hiba és helyreállítás | Döntési értékelés újratöltése | Kanonikus szerződés |
| Döntési értékelés | Elsődleges művelet | Értékelés mentése | Kanonikus szerződés |
| Markdown terv | Cím | Markdown terv | Kanonikus szerződés |
| Markdown terv | Betöltés | Markdown-revíziók betöltése… | Kanonikus szerződés |
| Markdown terv | Hiba és helyreállítás | A Markdown-revíziók nem tölthetők be · Revíziók újratöltése | Kanonikus szerződés |
| Markdown terv | Mező | Publikált sablon · Létrehozás oka · Mérföldkő | Kanonikus szerződés |
| Markdown terv | Elsődleges művelet | Markdown-revízió generálása | Kanonikus szerződés |
| Markdown terv | Üres állapot | Még nincs Markdown-revízió | Kanonikus szerződés |
| Markdown terv | Részletek | Revíziótörténet · Revízió részletei · Tartalmi előnézet · Markdown letöltése | Kanonikus szerződés |
| Projektbeállítások | Cím | Projektbeállítások | Kanonikus szerződés |
| Projektbeállítások | Szakasz | Projekt alapadatai | Kanonikus szerződés |
| Projektbeállítások | Művelet | Alapadatok mentése | Kanonikus szerződés |
| Projektbeállítások | Szakasz | Automatikus ügyfél-utánkövetés | Kanonikus szerződés |
| Projektbeállítások | Művelet | Utánkövetési beállítások mentése | Kanonikus szerződés |
| Projektbeállítások | Szakasz | Projekt életciklusa | Kanonikus szerződés |
| Projektbeállítások | Művelet | Életciklus-állapot mentése | Kanonikus szerződés |
| Projektbeállítások | Veszélyzóna | Projekt visszaállítása · Projekt archiválása · Projekt végleges törlése | Kanonikus szerződés |
| Projektbeállítások | Hiba és helyreállítás | A projektbeállítások nem tölthetők be · Projektbeállítások újratöltése | Kanonikus szerződés |
| Ügyféllevelezés | Cím | Ügyféllevelezés | Kanonikus szerződés |
| Ügyféllevelezés | Összegzés | {darab} feldolgozatlan ügyfélválasz | Kanonikus szerződés |
| Ügyféllevelezés | Művelet | Átnéztem · Feldolgozás megkezdése · Lezárás | Kanonikus szerződés |
| Ügyféllevelezés | Mező | Kézi besorolás | Kanonikus szerződés |
| Ügyféllevelezés | Betöltés | Az ügyféllevelezés betöltése folyamatban van… | Kanonikus szerződés |
| Ügyféllevelezés | Hiba és helyreállítás | Az ügyféllevelezés most nem tölthető be · Ügyféllevelezés újratöltése | Kanonikus szerződés |
| Ügyféllevelezés | Üres állapot | Még nincs ügyfélválasz · Felmérési összefoglaló előkészítése | Kanonikus szerződés |
| Ügyfél-emlékeztető | Cím | Ügyfél-emlékeztető | Kanonikus szerződés |
| Ügyfél-emlékeztető | Mező | Üzenet az ügyfélnek · Kapcsolódó nyitott tisztázási tétel · Feladó | Kanonikus szerződés |
| Ügyfél-emlékeztető | Művelet | Piszkozat mentése · Pontos előnézet · Küldés az ügyfélnek | Kanonikus szerződés |
| Ügyfél-emlékeztető | Kézbesítési állapot | Még nem történt küldés · Sikeresen elküldve · Sikertelen küldés | Kanonikus szerződés |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Ügyfél-emlékeztető újratöltése · Küldés újrapróbálása | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Cím | Nem társított ügyfélüzenetek | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Mező | Ügyféllevelezés | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Művelet | Üzenet társítása · Nem releváns | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Üres állapot | Nincs feldolgozandó, nem társított üzenet. | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Hiba és helyreállítás | Üzenetek újratöltése | Kanonikus szerződés |
| Markdown beállítások | Cím | Markdown beállítások | Kanonikus szerződés |
| Markdown beállítások | Művelet | Új sablon · Piszkozat mentése · Előnézet · Publikálás | Kanonikus szerződés |
| Markdown beállítások | Hiba és helyreállítás | A sablonok nem tölthetők be · Sablonok újratöltése | Kanonikus szerződés |
| Kérdésbank beállítások | Cím | Kérdésbank beállítások | Kanonikus szerződés |
| Kérdésbank beállítások | Mező | Kérdésazonosító · Témakör · Kérdés · Típus · Sorrend | Kanonikus szerződés |
| Kérdésbank beállítások | Művelet | Új alapkérdés · Alapkérdés létrehozása · Módosítások mentése | Kanonikus szerződés |
| Kérdésbank beállítások | Üres állapot | Még nincs alapkérdés | Kanonikus szerződés |
| Kérdésbank beállítások | Hiba és helyreállítás | A kérdésbank nem tölthető be · Kérdésbank újratöltése | Kanonikus szerződés |
| Alkalmazáskeret | Akadálymentes név | Project Maker áttekintő | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Akadálymentes név | Fő navigáció | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Látható szöveg | PM | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Látható szöveg | Project Maker | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Súgó | Napi projektmunka egy helyen | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Áttekintő | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Új projekt | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Folyamatban lévő ügyek | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Utánkövetések | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Markdown beállítások | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Kérdésbank beállítások | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Futásidejű UI-szöveg | :host display: block; min-height: 100vh; .app-header border-bottom: 1px solid var(--p-content-border-color); background: color-mix(in srgb, white 92%, var(--pm-cyan)); backdrop-filter: blur(0.75rem); position: sticky; top: 0; z-index: 10; .header-inner align-items: center; display: flex; gap: 1.5rem; justify-content: space-between; margin: 0 auto; max-width: 76rem; padding: 0 1.5rem; .brand align-items: center; color: var(--p-text-color); display: flex; gap: 0.75rem; padding: 0.85rem 0; text-decoration: none; .app-nav ul align-items: center; display: flex; gap: 0.35rem; list-style: none; margin: 0; padding: 0; .app-nav li align-items: center; display: flex; min-width: 0; .app-nav a border-radius: 0.55rem; color: var(--p-text-muted-color); padding: 0.55rem 0.75rem; text-decoration: none; .app-nav a:hover, .app-nav a.active background: var(--p-primary-50); color: var(--p-primary-color); .queue-nav-item background: color-mix(in srgb, var(--p-primary-50) 55%, transparent); border-radius: 0.55rem; .reply-count align-items: center; background: var(--p-primary-color); border-radius: 999px !important; color: var(--p-primary-contrast-color) !important; display: inline-flex; font-size: 0.75rem; font-weight: 800; justify-content: center; margin-right: 0.35rem; min-height: 1.55rem; min-width: 1.55rem; padding: 0.2rem 0.45rem !important; .brand-mark align-items: center; background: var(--p-primary-color); border-radius: 0.7rem; color: var(--p-primary-contrast-color); display: inline-flex; font-size: 0.78rem; font-weight: 800; height: 2.25rem; justify-content: center; letter-spacing: 0.04em; width: 2.25rem; .brand strong, .brand small display: block; .brand small color: var(--p-text-muted-color); font-size: 0.75rem; margin-top: 0.1rem; .app-main margin: 0 auto; max-width: 76rem; padding: 2.5rem 1.5rem 4rem; @media (max-width: 42rem) .header-inner align-items: flex-start; flex-direction: column; gap: 0; .app-nav, .app-nav ul flex-wrap: wrap; padding-bottom: 0.65rem; width: 100%; | apps/web/src/app/app.component.ts:57 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | eyJpZCI6ImU4NTEzMzYyLWZmZmMtNDdkZC1iMGVhLWIyMTU0MTY4NmEzNSIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODYwMTkwNzYsImV4cCI6MTgxNzU1NTA3Nn0.5m4EjSjYjkFbzebLQ6Gv0LkY5HirW8bj2ZuuCOt0NDJqa8RxP7pMw3VO10Wb9D0UAUeCqOU-IIa7Y9bOqyUgDQ | apps/web/src/app/app.config.ts:10 |
| Megosztott felületi szöveg | Címke | Áttekintő \| Project Maker | apps/web/src/app/app.routes.ts:10 |
| Megosztott felületi szöveg | Címke | Új projekt \| Project Maker | apps/web/src/app/app.routes.ts:18 |
| Megosztott felületi szöveg | Címke | Folyamatban lévő ügyek \| Project Maker | apps/web/src/app/app.routes.ts:26 |
| Megosztott felületi szöveg | Címke | Utánkövetések \| Project Maker | apps/web/src/app/app.routes.ts:34 |
| Megosztott felületi szöveg | Címke | Nem társított ügyfélüzenetek \| Project Maker | apps/web/src/app/app.routes.ts:42 |
| Megosztott felületi szöveg | Címke | Projektállapot \| Project Maker | apps/web/src/app/app.routes.ts:57 |
| Megosztott felületi szöveg | Címke | Felmérés \| Project Maker | apps/web/src/app/app.routes.ts:65 |
| Megosztott felületi szöveg | Címke | Felkészültség \| Project Maker | apps/web/src/app/app.routes.ts:73 |
| Megosztott felületi szöveg | Címke | Döntési értékelés \| Project Maker | apps/web/src/app/app.routes.ts:81 |
| Megosztott felületi szöveg | Címke | Markdown terv \| Project Maker | apps/web/src/app/app.routes.ts:89 |
| Megosztott felületi szöveg | Címke | Ügyféllevelezés \| Project Maker | apps/web/src/app/app.routes.ts:97 |
| Megosztott felületi szöveg | Címke | Projektbeállítások \| Project Maker | apps/web/src/app/app.routes.ts:105 |
| Megosztott felületi szöveg | Címke | Kérdésbank beállítások \| Project Maker | apps/web/src/app/app.routes.ts:120 |
| Megosztott felületi szöveg | Címke | Markdown beállítások \| Project Maker | apps/web/src/app/app.routes.ts:128 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 8%, white) | apps/web/src/app/app.theme.ts:44 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 16%, white) | apps/web/src/app/app.theme.ts:45 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 28%, white) | apps/web/src/app/app.theme.ts:46 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 48%, white) | apps/web/src/app/app.theme.ts:47 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 72%, projectMaker.cyan ) | apps/web/src/app/app.theme.ts:48 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | projectMaker.electricBlue | apps/web/src/app/app.theme.ts:49 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 88%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:50 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 72%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:51 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 52%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:52 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.electricBlue 28%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:53 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | projectMaker.deepNavy | apps/web/src/app/app.theme.ts:54 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | primary.500 | apps/web/src/app/app.theme.ts:55 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | primary.600 | apps/web/src/app/app.theme.ts:57 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | primary.700 | apps/web/src/app/app.theme.ts:58 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 8%, white) | apps/web/src/app/app.theme.ts:64 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 14%, white) | apps/web/src/app/app.theme.ts:65 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 24%, white) | apps/web/src/app/app.theme.ts:66 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 42%, white) | apps/web/src/app/app.theme.ts:67 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | projectMaker.steelGray | apps/web/src/app/app.theme.ts:68 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 82%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:69 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 64%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:70 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 44%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:71 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 22%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:72 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | color-mix(in srgb, projectMaker.steelGray 10%, projectMaker.deepNavy ) | apps/web/src/app/app.theme.ts:73 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | surface.600 | apps/web/src/app/app.theme.ts:82 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | projectMaker.cyan | apps/web/src/app/app.theme.ts:85 |
| Megosztott felületi szöveg | Címke | Rövid szöveg | apps/web/src/app/base-question-type-label.ts:7 |
| Megosztott felületi szöveg | Címke | Hosszú szöveg | apps/web/src/app/base-question-type-label.ts:8 |
| Megosztott felületi szöveg | Címke | Egyszeres választás | apps/web/src/app/base-question-type-label.ts:9 |
| Megosztott felületi szöveg | Címke | Többszörös választás | apps/web/src/app/base-question-type-label.ts:10 |
| Megosztott felületi szöveg | Címke | Igen vagy nem | apps/web/src/app/base-question-type-label.ts:11 |
| Megosztott felületi szöveg | Címke | Szám | apps/web/src/app/base-question-type-label.ts:12 |
| Megosztott felületi szöveg | Címke | Dátum | apps/web/src/app/base-question-type-label.ts:13 |
| Megosztott felületi szöveg | Hiba és helyreállítás | InterviewApiError | apps/web/src/app/interviews/interview-api.service.ts:20 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni az aktív kezdő felmérési kört | apps/web/src/app/interviews/interview-api.service.ts:43 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a kiválasztott felmérési kört | apps/web/src/app/interviews/interview-api.service.ts:53 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | elindítani a felmérési kört | apps/web/src/app/interviews/interview-api.service.ts:64 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | elmenteni a választ | apps/web/src/app/interviews/interview-api.service.ts:82 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | elmenteni az értékelést | apps/web/src/app/interviews/interview-api.service.ts:99 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | visszaállítani az automatikus értékelést | apps/web/src/app/interviews/interview-api.service.ts:114 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | lezárni a felmérési kört | apps/web/src/app/interviews/interview-api.service.ts:126 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra. | apps/web/src/app/interviews/interview-api.service.ts:164 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Ellenőrizd, hogy a projekt, a felmérési kör vagy a kérdés még létezik-e. | apps/web/src/app/interviews/interview-api.service.ts:171 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Frissítsd az oldalt, hogy a legfrissebb felmérési állapotot lásd, majd próbáld újra. | apps/web/src/app/interviews/interview-api.service.ts:173 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Ellenőrizd az adatokat, majd próbáld újra. | apps/web/src/app/interviews/interview-api.service.ts:174 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Nem sikerült {érték}. {érték} | apps/web/src/app/interviews/interview-api.service.ts:176 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Nem sikerült {érték}. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/interviews/interview-api.service.ts:182 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | betölteni az összefoglalókat | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:12 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | betölteni a feladókat | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:13 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | betölteni az összefoglalót | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:14 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | létrehozni az új verziót | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:15 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | menteni a módosítás leírását | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:16 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | elkészíteni az előnézetet | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:17 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | elküldeni az összefoglalót | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:18 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | újrapróbálni a küldést | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:19 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | folytatni a szerkesztést | apps/web/src/app/interviews/interview-handoff/interview-handoff-api.service.ts:20 |
| Felmérési összefoglaló | Akadálymentes név | Aktív összefoglaló-tervezet | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Művelet | Módosítás leírásának mentése | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Művelet | Előnézet és küldés | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Művelet | Összefoglaló újraküldése | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Művelet | Ellenőrzés után újrapróbálás | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Művelet | Új verzió készítése | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Művelet | Küldés az ügyfélnek | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Akadálymentes név | Megnyitott ügyfélcsomag-verzió | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Ügyfélnek küldött felmérési összefoglalók | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Az elküldött verziók változatlan előzményként megmaradnak. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Az archivált projekt ügyfélcsomagjai csak olvashatók. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Cím | {érték}. verzió – {érték} | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Mező | Módosítás összefoglalása | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Mező | Feladó | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Dedikált postafiók – {érték} &lt;{érték}&gt; | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Saját PO/PM postafiók | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Mező | Feladó neve | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Mező | Feladó @pte.hu címe | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | A levelezőrendszer elutasította az átadást. Az eredeti levél változatlan tartalommal újraküldhető. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Az ügyfél válasza igazolja az átvételt. Az eredeti bizonytalan kézbesítési eredmény megmarad; újraküldés nem szükséges. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | A levelezőrendszer átvételi eredménye nem ismert. Újrapróbálás előtt ellenőrizd a kimenő postafiókot. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Cím | {érték}. verzió előnézete | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Címzett: | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | {érték} &lt;{érték}&gt; | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Feladó: | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Tárgy: | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Cím | Verzióelőzmények | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Művelet | Tartalom megnyitása – {érték} | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Küldés ideje: | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Futásidejű UI-szöveg | {érték} ({érték}) részére küldöd a {érték}. verziót. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:66 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | Felmérési összefoglaló küldése | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:66 |
| Felmérési összefoglaló | Címke | Küldés az ügyfélnek | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:66 |
| Felmérési összefoglaló | Címke | Mégse | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:66 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | Ismeretlen átadás ellenőrzése | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:71 |
| Felmérési összefoglaló | Futásidejű UI-szöveg | A levelezőrendszer korábbi átvétele nem bizonyítható. Ellenőrizted a kimenő postafiókot, és vállalod az esetleges kettős küldést? | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:71 |
| Felmérési összefoglaló | Címke | Ellenőriztem, újrapróbálom | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:71 |
| Felmérési összefoglaló | Címke | Piszkozat | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:74 |
| Felmérési összefoglaló | Címke | Átadás folyamatban | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:74 |
| Felmérési összefoglaló | Címke | Átadva a levelezőrendszernek | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:74 |
| Felmérési összefoglaló | Hiba és helyreállítás | Sikertelen | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:74 |
| Felmérési összefoglaló | Címke | Ellenőrzést igényel | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.ts:74 |
| Felmérési összefoglaló | Művelet | Új összefoglaló-verzió készítése | apps/web/src/app/interviews/interview-handoff/interview-reply-outcome.component.ts |
| Felmérési összefoglaló | Futásidejű UI-szöveg | Módosítást kér | apps/web/src/app/interviews/interview-handoff/interview-reply-outcome.component.ts:35 |
| Felmérési összefoglaló | Hiba és helyreállítás | Az új összefoglaló-verzió nem indítható. Töltsd újra az adatokat, és ellenőrizd a projekt állapotát. | apps/web/src/app/interviews/interview-handoff/interview-reply-outcome.component.ts:54 |
| Felmérés | Művelet | Felmérési oldal újratöltése | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Felmérés indításának újrapróbálása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Mentés újrapróbálása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Automatikus állapot | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Részben megvan | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Nem releváns | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Indoklás mentése | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Értékelés újrapróbálása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Felmérés lezárása és továbblépés | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Lezárás és ügyfélcsomag előnézete | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Projektfelmérés | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Válaszd ki az aktív kérdéseket, fogadd el a kérdéssémát, majd folytasd a kezdő felmérési kört. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Az archivált projekt felmérése és ügyfélcsomagjai csak olvashatók. Módosításhoz előbb állítsd vissza a projektet. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | A felmérési összegzés még nem érhető el. Előbb fogadd el a kérdéssémát és indítsd el a kezdő felmérést ezen az oldalon. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | A felmérési összegzés még nem érhető el. Előbb zárd le a kezdő felmérési kört ezen az oldalon. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Betöltjük a kérdésbankot, a projektsémát és az aktív felmérési kört… | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Cím | A felmérési oldal nem tölthető be | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Projekt alapadatainak szerkesztése | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Projekt kérdésséma | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Bankverzió {érték} · {érték} aktív kérdés kiválasztva | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Elfogadott kérdésséma v{érték} (bank v{érték}) | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | A kérdésséma elfogadva. A kezdő felmérés indítása még hátravan. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Cím | Nincs aktív alapkérdés | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Kérj meg egy Beállítások-adminisztrátort, hogy legalább egy alapkérdést aktiváljon. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Mező | Aktív alapkérdések kiválasztása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Súgó | {érték} · {érték} | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Még nincs elfogadott kérdésséma. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | A kérdésséma zárolva van, amíg a nyitott kezdő felmérési kör fut. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Kezdő felmérési kör | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | A felmérési kör a kiválasztott kérdésséma változatlan pillanatképét őrzi. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Folyamatban lévő kezdő felmérési kör folytatása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | A legutóbb mentett állapot töltődött vissza, ezért innen folytathatod ugyanazt a kört. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | {érték} pillanatkép-kérdés | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Cím | Nincs kérdés ebben a felmérési körben | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Frissítsd a projektsémát, majd indíts új kört. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Ellenőrzési pont: {érték} | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Kötelező kérdés | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Blokkoló tisztázás | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Válassz egy lehetőséget | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Igen | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Értékelés | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Mező | Indoklás, miért nem releváns | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Ez blokkoló tisztázás. Rögzítsd a választ, mielőtt lezárod a kört. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Hiba és helyreállítás | A felmérési kör nem zárható le, amíg van sikertelen válaszmentés. Mentsd újra a hibás válaszokat, majd próbáld újra. | apps/web/src/app/interviews/interview.page.ts:30 |
| Felmérés | Futásidejű UI-szöveg | A felmérési kör lezárása előtt várd meg, amíg minden automatikus mentés befejeződik. | apps/web/src/app/interviews/interview.page.ts:32 |
| Felmérés | Hiba és helyreállítás | A felmérési kör nem zárható le, amíg van sikertelen értékelésmentés. Mentsd újra a hibás értékeléseket, majd próbáld újra. | apps/web/src/app/interviews/interview.page.ts:34 |
| Felmérés | Futásidejű UI-szöveg | A felmérési kör lezárása előtt várd meg, amíg minden értékelés mentése befejeződik. | apps/web/src/app/interviews/interview.page.ts:36 |
| Felmérés | Futásidejű UI-szöveg | Hiányzik a projektazonosító a felmérés URL-jéből. Menj vissza az Áttekintőre, és nyisd meg újra a felmérést. | apps/web/src/app/interviews/interview.page.ts:116 |
| Felmérés | Futásidejű UI-szöveg | Nem támogatott aktív felmérési kör érkezett. Frissítsd az oldalt, és ha a hiba megmarad, ellenőrizd a projekt felmérési állapotát. | apps/web/src/app/interviews/interview.page.ts:142 |
| Felmérés | Futásidejű UI-szöveg | A kérdésséma nem módosítható, amíg van nyitott kezdő felmérési kör. | apps/web/src/app/interviews/interview.page.ts:197 |
| Felmérés | Futásidejű UI-szöveg | Legalább egy aktív alapkérdést ki kell választanod a projektséma közzététele előtt. | apps/web/src/app/interviews/interview.page.ts:203 |
| Felmérés | Futásidejű UI-szöveg | A projekt kérdéssémája elkészült. | apps/web/src/app/interviews/interview.page.ts:242 |
| Felmérés | Futásidejű UI-szöveg | A projekt kérdéssémája frissült. | apps/web/src/app/interviews/interview.page.ts:243 |
| Felmérés | Futásidejű UI-szöveg | A felmérési kör indítása előtt fogadd el a projekt kérdéssémáját. | apps/web/src/app/interviews/interview.page.ts:260 |
| Felmérés | Futásidejű UI-szöveg | A kezdő felmérési kör elindult. | apps/web/src/app/interviews/interview.page.ts:300 |
| Felmérés | Hiba és helyreállítás | A kérdésséma elfogadva van, de a kezdő felmérési kör nem indult el. Próbáld újra a felmérés indítását. | apps/web/src/app/interviews/interview.page.ts:305 |
| Felmérés | Futásidejű UI-szöveg | Értékelés mentése folyamatban… | apps/web/src/app/interviews/interview.page.ts:515 |
| Felmérés | Futásidejű UI-szöveg | Nem sikerült elmenteni az értékelést. {érték} | apps/web/src/app/interviews/interview.page.ts:519 |
| Felmérés | Futásidejű UI-szöveg | Nem sikerült elmenteni az értékelést. Próbáld újra. | apps/web/src/app/interviews/interview.page.ts:520 |
| Felmérés | Futásidejű UI-szöveg | Értékelési piszkozat | apps/web/src/app/interviews/interview.page.ts:523 |
| Felmérés | Futásidejű UI-szöveg | Értékelés mentve | apps/web/src/app/interviews/interview.page.ts:525 |
| Felmérés | Futásidejű UI-szöveg | Mentés folyamatban… | apps/web/src/app/interviews/interview.page.ts:641 |
| Felmérés | Futásidejű UI-szöveg | Nem sikerült menteni. {érték} | apps/web/src/app/interviews/interview.page.ts:645 |
| Felmérés | Futásidejű UI-szöveg | Nem sikerült menteni. Próbáld újra. | apps/web/src/app/interviews/interview.page.ts:646 |
| Felmérés | Futásidejű UI-szöveg | Piszkozat – automatikus mentésre vár | apps/web/src/app/interviews/interview.page.ts:649 |
| Felmérés | Futásidejű UI-szöveg | Mentve | apps/web/src/app/interviews/interview.page.ts:652 |
| Felmérés | Futásidejű UI-szöveg | Még nincs mentve | apps/web/src/app/interviews/interview.page.ts:654 |
| Felmérés | Címke | Válasz újramentése: {érték} | apps/web/src/app/interviews/interview.page.ts:666 |
| Felmérés | Címke | Kezdő felmérés | apps/web/src/app/interviews/interview.page.ts:680 |
| Felmérés | Futásidejű UI-szöveg | Rövid, tömör válasz ajánlott. | apps/web/src/app/interviews/interview.page.ts:688 |
| Felmérés | Futásidejű UI-szöveg | Részletes, többmondatos válasz ajánlott. | apps/web/src/app/interviews/interview.page.ts:690 |
| Felmérés | Futásidejű UI-szöveg | Pontosan egy lehetőséget válassz. | apps/web/src/app/interviews/interview.page.ts:692 |
| Felmérés | Futásidejű UI-szöveg | Egy vagy több lehetőséget is kiválaszthatsz. | apps/web/src/app/interviews/interview.page.ts:694 |
| Felmérés | Futásidejű UI-szöveg | Jelöld be, ha a válasz igen. | apps/web/src/app/interviews/interview.page.ts:696 |
| Felmérés | Futásidejű UI-szöveg | Adj meg egy véges számértéket. | apps/web/src/app/interviews/interview.page.ts:698 |
| Felmérés | Futásidejű UI-szöveg | Add meg a dátumot ÉÉÉÉ-HH-NN formátumban. | apps/web/src/app/interviews/interview.page.ts:700 |
| Felmérés | Futásidejű UI-szöveg | Választható lehetőségek: {érték} | apps/web/src/app/interviews/interview.page.ts:709 |
| Felmérés | Futásidejű UI-szöveg | Részben megvan | apps/web/src/app/interviews/interview.page.ts:785 |
| Felmérés | Futásidejű UI-szöveg | Nem releváns | apps/web/src/app/interviews/interview.page.ts:785 |
| Felmérés | Hiba és helyreállítás | A felmérési oldal nem tölthető be. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/interviews/interview.page.ts:1204 |
| Felmérés | Hiba és helyreállítás | Nem sikerült frissíteni a projektsémát. Frissítsd az oldalt, ellenőrizd a kiválasztott kérdéseket, majd próbáld újra. | apps/web/src/app/interviews/interview.page.ts:1209 |
| Felmérés | Hiba és helyreállítás | Nem sikerült közzétenni a projektsémát. Frissítsd az oldalt, ellenőrizd a kiválasztott kérdéseket, majd próbáld újra. | apps/web/src/app/interviews/interview.page.ts:1212 |
| Markdown terv | Futásidejű UI-szöveg | generálni a Markdown-revíziót | apps/web/src/app/markdown/markdown-api.service.ts:25 |
| Markdown terv | Futásidejű UI-szöveg | betölteni a Markdown-sablonokat | apps/web/src/app/markdown/markdown-api.service.ts:32 |
| Markdown terv | Futásidejű UI-szöveg | betölteni a Markdown-revíziókat | apps/web/src/app/markdown/markdown-api.service.ts:41 |
| Markdown terv | Futásidejű UI-szöveg | betölteni a Markdown-revíziót | apps/web/src/app/markdown/markdown-api.service.ts:51 |
| Markdown terv | Hiba és helyreállítás | Nem sikerült {érték}. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:83 |
| Markdown terv | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:90 |
| Markdown terv | Hiba és helyreállítás | Ellenőrizd, hogy a projekt vagy a revízió még létezik-e. | apps/web/src/app/markdown/markdown-api.service.ts:97 |
| Markdown terv | Hiba és helyreállítás | Frissítsd a projektet a legújabb revízióállapotért, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:100 |
| Markdown terv | Hiba és helyreállítás | Ellenőrizd a kiválasztott létrehozási okot, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:101 |
| Markdown terv | Hiba és helyreállítás | Nem sikerült {érték}. {érték} | apps/web/src/app/markdown/markdown-api.service.ts:103 |
| Markdown terv | Futásidejű UI-szöveg | A kötelező sablonblokk nem áll rendelkezésre: | apps/web/src/app/markdown/markdown-api.service.ts:111 |
| Markdown terv | Futásidejű UI-szöveg | {érték} Pótold a megnevezett projektadatot, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:112 |
| Markdown terv | Futásidejű UI-szöveg | Archivált projekthez nem generálható Markdown-revízió | apps/web/src/app/markdown/markdown-api.service.ts:114 |
| Markdown terv | Futásidejű UI-szöveg | Archivált projekthez nem generálható Markdown-revízió. Előbb állítsd vissza a projektet a Projektbeállításokban. | apps/web/src/app/markdown/markdown-api.service.ts:115 |
| Markdown terv | Művelet | Revíziók újratöltése | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Mezősúgó | Például: Felmérés lezárva | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Művelet | Revízió részleteinek újratöltése | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Generált dokumentum | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Hozz létre változatlan, kanonikus Markdown-specifikációt a projekt aktuális előkészítési adataiból, és tekintsd át a történetét. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Markdown-revíziók betöltése… | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Cím | A Markdown-revíziók nem tölthetők be | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Új revízió generálása | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | A projekt- és felmérési adatok változatlan forráspillanatképként kerülnek a revízióba. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Mező | Publikált sablon | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | {érték} · v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Súgó | A sikeres generálás után ezt a választást jegyzi meg a projekt. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Mező | Létrehozás oka | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Súgó | Válassz mérföldkő-okot, ha a pillanatkép egy névvel ellátott átadási ellenőrzési pontot rögzít. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Mező | Mérföldkő | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Súgó | Csak mérföldkő-revíziónál kötelező; kézi generálásnál hagyd üresen. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Súgó | Add meg a mérföldkő nevét. A mérföldkő legfeljebb 255 karakter lehet. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Revíziótörténet | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | A legújabb revízió jelenik meg elsőként. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Cím | Még nincs Markdown-revízió | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Generáld az első revíziót a letölthető kanonikus specifikáció létrehozásához. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Revízió v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Súgó | {érték}{érték} | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Revízió részletei | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Revízió részleteinek betöltése… | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Cím | A revízió részletei nem tölthetők be | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Változatlan pillanatkép | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Cím | Revízió v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Létrehozva | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Mérföldkő | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Forrásverzió | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Sablon | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | {érték} · v{érték} Korábbi, eredethivatkozás nélküli revízió | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Előző revízió | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Művelet | Előző revízió megnyitása | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Első revízió | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Cím | Változásösszefoglaló | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Művelet | Markdown letöltése | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Cím | Tartalmi előnézet | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Cím | Válassz revíziót | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Látható szöveg | Válassz egy revíziót a történetből a forrás és a tartalom megtekintéséhez. | apps/web/src/app/markdown/markdown.page.html |
| Markdown terv | Címke | Kézi generálás | apps/web/src/app/markdown/markdown.page.ts:33 |
| Markdown terv | Címke | Mérföldkő elérése | apps/web/src/app/markdown/markdown.page.ts:33 |
| Markdown terv | Hiba és helyreállítás | betölteni a Markdown-sablonokat | apps/web/src/app/markdown/markdown.page.ts:108 |
| Markdown terv | Futásidejű UI-szöveg | A Markdown URL-ből hiányzik a projektazonosító. Térj vissza a projektállapothoz, majd nyisd meg újra a Markdown tervet. | apps/web/src/app/markdown/markdown.page.ts:115 |
| Markdown terv | Hiba és helyreállítás | betölteni a Markdown-revíziókat | apps/web/src/app/markdown/markdown.page.ts:139 |
| Markdown terv | Futásidejű UI-szöveg | A mérföldkő-revízió generálása előtt add meg a mérföldkő nevét. | apps/web/src/app/markdown/markdown.page.ts:154 |
| Markdown terv | Futásidejű UI-szöveg | A Markdown-revízió v{érték} verziója elkészült. | apps/web/src/app/markdown/markdown.page.ts:170 |
| Markdown terv | Hiba és helyreállítás | generálni a Markdown-revíziót | apps/web/src/app/markdown/markdown.page.ts:176 |
| Markdown terv | Hiba és helyreállítás | betölteni a Markdown-revíziót | apps/web/src/app/markdown/markdown.page.ts:233 |
| Folyamatban lévő ügyek | Mezősúgó | Keresés projektnévben | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Akadálymentes név | A folyamatban lévő ügyek lapozása | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | ← Vissza az Áttekintőre | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Portfólió | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Az aktív projektek következő teendői sürgősség szerint rendezve. | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Cím | Lista szűrése | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Projektnév | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Mező | Sürgősség | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | {érték} ({érték}) | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Mező | Felkészültség | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Lista frissítése | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Utolsó lekérés: {érték} | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Cím | A lista elavult lehet. | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Sikertelen lekérés újrapróbálása | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | A folyamatban lévő ügyek betöltése… | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Cím | A folyamatban lévő ügyek nem tölthetők be | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Lista újratöltése | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Cím | Nincs találat | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Nincs a keresésnek és a kiválasztott szűrőknek megfelelő aktív projekt. | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Szűrők törlése | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Cím | Nincs aktív projekt | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | A listában minden nem archivált projekt megjelenik. | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Áttekintő megnyitása | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Új projekt létrehozása | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | {érték} projekt látható az összesen {érték} aktív projektből | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Frissítés folyamatban… | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | {érték} látható, összesen {érték} projekt | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Következő lépés | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Felelős | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Határidő | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Új válaszok | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Látható szöveg | Előrehaladás | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Előző oldal | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Művelet | Következő oldal | apps/web/src/app/projects/active-project-queue.page.html |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Új ügyfélválasz | apps/web/src/app/projects/active-project-queue.page.ts:41 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Lejárt | apps/web/src/app/projects/active-project-queue.page.ts:42 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Hamarosan lejár | apps/web/src/app/projects/active-project-queue.page.ts:43 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Folyamatban | apps/web/src/app/projects/active-project-queue.page.ts:44 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Kérdésséma szükséges | apps/web/src/app/projects/active-project-queue.page.ts:47 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Felmérés folyamatban | apps/web/src/app/projects/active-project-queue.page.ts:48 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Tisztázás szükséges | apps/web/src/app/projects/active-project-queue.page.ts:49 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Döntési értékelés szükséges | apps/web/src/app/projects/active-project-queue.page.ts:50 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Becslés előkészíthető | apps/web/src/app/projects/active-project-queue.page.ts:51 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Becslésre kész | apps/web/src/app/projects/active-project-queue.page.ts:52 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | A korábbi oldal már nem állítható helyre. Az első oldalt mutatjuk. | apps/web/src/app/projects/active-project-queue.page.ts:151 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | Ismeretlen betöltési hiba. | apps/web/src/app/projects/active-project-queue.page.ts:157 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | A lista frissítve. | apps/web/src/app/projects/active-project-queue.page.ts:174 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | A lista ismét elérhető. | apps/web/src/app/projects/active-project-queue.page.ts:176 |
| Folyamatban lévő ügyek | Futásidejű UI-szöveg | A lista frissítése nem sikerült. A korábbi adatok maradtak láthatók. | apps/web/src/app/projects/active-project-queue.page.ts:183 |
| Ügyféllevelezés | Művelet | Ügyféllevelezés újratöltése | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Ügyfélkapcsolat | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Az ügyfélválaszok feldolgozása és az emlékeztetők előkészítése egy helyen. | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Az ügyféllevelezés betöltése folyamatban van… | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Cím | Az ügyféllevelezés most nem tölthető be | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Az archivált projekt levelezése olvasható. A feldolgozáshoz vagy a forrásfolyamat módosításához előbb állítsd vissza a projektet. | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | {érték} feldolgozatlan ügyfélválasz | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Cím | Még nincs ügyfélválasz | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Az elküldött összefoglalókra és emlékeztetőkre érkező válaszok itt jelennek meg. | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Művelet | Felmérési összefoglaló előkészítése | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | {érték} olvasatlan üzenet | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Művelet | Átnéztem | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Művelet | Feldolgozás megkezdése | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Művelet | Lezárás | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Az ügyfél válasza igazolja az átvételt. A bizonytalan kézbesítési eredmény változatlanul megmarad; újraküldés nem javasolt. | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Az ügyfélkapcsolatok között nem szereplő válaszfeladó | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Válassz besorolást | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | Korábbi idézett levelezés | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | {érték} melléklet | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Látható szöveg | {érték} — {érték} — {érték} byte | apps/web/src/app/projects/customer-correspondences.page.ts |
| Ügyféllevelezés | Hiba és helyreállítás | A művelet nem hajtható végre a jelenlegi adatokkal. Töltsd újra az adatokat, majd próbáld meg ismét. | apps/web/src/app/projects/customer-correspondences.page.ts:232 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | CustomerFollowUpApiError | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:23 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | betölteni az ügyfél-emlékeztetőt | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:34 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | betölteni a hivatkozható tisztázási tételeket | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:45 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | betölteni az ügyfél-emlékeztető feladóit | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:52 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | menteni az automatikus emlékeztető beállításait | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:62 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | menteni az ügyfél-emlékeztető piszkozatát | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:72 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | elkészíteni az ügyfél-emlékeztető előnézetét | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:85 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | elküldeni az ügyfél-emlékeztetőt | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:95 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | újrapróbálni az ügyfél-emlékeztetőt | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:108 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Nem sikerült {érték}. Próbáld meg újra. | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:125 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Előbb ments egy nem üres ügyfél-emlékeztetőt. | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:139 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Nem sikerült {érték}, mert az állapot időközben megváltozott. Töltsd újra az aktuális piszkozatot. | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:145 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | A kézbesítési eredmény bizonytalan. Ellenőrizd a kimenő postafiókot az újraküldés előtt. | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:153 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Az ügyfél-emlékeztető küldése sikertelen. Kézzel újrapróbálható. | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:159 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Nem sikerült {érték}, mert az e-mail-küldés nem érhető el. Ellenőrizd a Microsoft 365 beállításait. | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:165 |
| Ügyfél-emlékeztető | Művelet | Ügyfél-emlékeztető újratöltése | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Küldés újrapróbálása | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Ellenőriztem, újraküldöm | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Mégse | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Piszkozat mentése | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Pontos előnézet | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Kockázat elfogadása és friss küldés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Küldés az ügyfélnek | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Utánkövetési beállítások mentése | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Akadálymentes név | Ügyfél-utánkövetés állapota | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Akadálymentes név | Ügyféllevelezési műveletek | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Automatikus ügyfél-utánkövetés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Az emlékeztetők ütemezésének projektbeállításai. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Ügyfél-emlékeztető | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Rövid emlékeztető előkészítése, ellenőrzése és küldése. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Az ügyfél-emlékeztető küldése folyamatban van | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | A kézbesítési eredményig a projekt többi művelete nem indítható el. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Az ügyfél-emlékeztető küldése sikertelen | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | A rendszer bizonyított kézbesítési hibát kapott. A küldést csak kézzel lehet újrapróbálni. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Az ügyfél-emlékeztető eredménye bizonytalan | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Az ügyfél válasza igazolja az átvételt. Az eredeti bizonytalan eredmény megmarad; újraküldés nem szükséges. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Ellenőrizd a kimenő postafiókot. Az újraküldés duplikált levelet eredményezhet. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Az automatikus ügyfél-emlékeztető szünetel | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | A mentett piszkozat vagy a kapcsolódó tisztázási tétel már nem érvényes. Frissítsd és mentsd a piszkozatot az újraütemezéshez. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Ügyfél-emlékeztető újraküldése | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | A korábbi kézbesítés eredménye bizonytalan; az újraküldés duplikált levelet eredményezhet. A korábbi küldés bizonyítottan sikertelen volt. Indíts új, kézi kézbesítési kísérletet? | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Ügyfél-emlékeztető piszkozata | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Üzenet az ügyfélnek | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Súgó | A szöveg egyszerű szövegként kerül az e-mailbe, legfeljebb 10 000 karakterben. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Kapcsolódó nyitott tisztázási tétel (nem kötelező) | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Nincs kapcsolódó kérdés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | {érték} · {érték} | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Feladó | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Dedikált postafiók – {érték} &lt;{érték}&gt; | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Saját PO/PM postafiók | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Feladó neve | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Feladó pontos @pte.hu címe | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Ügyfél-emlékeztető előnézete | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Ezt a pontos címzettet és tartalmat küldi el a rendszer. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Címzett | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | {érték} &lt;{érték}&gt; | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Feladó | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Tárgy | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | A korábbi küldés eredménye bizonytalan. A friss küldés duplikált levelet eredményezhet; csak a kimenő postafiók ellenőrzése után folytasd. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Automatikus ügyfél-utánkövetés beállításai | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Automatikus ügyfél-emlékeztetők engedélyezése | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Küldési időköz percben | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Súgó | Adj meg 1 és 525 600 közötti egész percértéket. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Súgó | Az időköz 1 és 525 600 közötti egész szám legyen. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Automatikus küldés vége | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Súgó | Határozatlan időhöz hagyd üresen. A helyi időpont pontos időbélyegként lesz mentve. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Automatikus emlékeztetők | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Küldési időköz | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | {érték} perc | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Automatikus küldés vége | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Legutóbbi emlékeztető | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Következő automatikus emlékeztető | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Legutóbbi kézbesítés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Kézbesítési hiba | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Felmérési összefoglaló megnyitása | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | Az automatikus ügyfél-utánkövetés beállításai mentve lettek. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:213 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | Piszkozat mentve. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:246 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | Átadva a levelezőrendszernek. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:345 |
| Ügyfél-emlékeztető | Címke | Még nem történt küldés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:443 |
| Ügyfél-emlékeztető | Címke | Sikeresen elküldve | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:444 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Sikertelen küldés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:445 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Nincs jelzett hiba | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:450 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | A kézbesítés eredménye bizonytalan. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:452 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | A levelezőrendszer elutasította a küldést. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:454 |
| Nem társított ügyfélüzenetek | Művelet | Üzenetek újratöltése | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Művelet | ← Vissza az Áttekintőre | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | Ügyfélkapcsolat | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | Minden üzenetről külön dönthetsz: meglévő levelezéshez társítod, vagy nem relevánsként elveted. | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | Az üzenetek betöltése folyamatban van… | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Cím | Feldolgozandó üzenetek | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | Nincs feldolgozandó, nem társított üzenet. | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | Feladó: {érték} | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | {érték} melléklet | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | Válassz levelezést… | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | {érték} — {érték} | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Művelet | Üzenet társítása | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Művelet | Nem releváns | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Cím | Levelezőrendszer-események | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Látható szöveg | Nincs új levelezőrendszer-esemény. | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Futásidejű UI-szöveg | Az üzenet társításához válassz ügyféllevelezést. | apps/web/src/app/projects/customer-mail-triage.page.ts:60 |
| Nem társított ügyfélüzenetek | Címke | Kézbesítési jelentés | apps/web/src/app/projects/customer-mail-triage.page.ts:75 |
| Nem társított ügyfélüzenetek | Címke | Automatikus távolléti válasz | apps/web/src/app/projects/customer-mail-triage.page.ts:75 |
| Döntési értékelés | Látható szöveg | Projektkörnyezet | apps/web/src/app/projects/decision-review.page.html |
| Döntési értékelés | Látható szöveg | A felkészültség és a hat értékelési szempont közös döntési eredménye. | apps/web/src/app/projects/decision-review.page.html |
| Döntési értékelés | Művelet | Döntési értékelés újratöltése | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Művelet | Döntési értékelés mentése | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Döntési értékelés | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | A pontszám és az ajánlás a hat értékelésből és az aktuális felkészültségből készül. | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Betöltés folyamatban… | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Mező | Értékelési szempontok | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Az értékek {érték}-től {érték}-ig adhatók meg. A fordított irányban számító szempontokat a súlylista jelöli. | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Nincs megadva | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Az archivált projekt értékelése csak olvasható. A módosításhoz állítsd vissza a projektet. | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Cím | Értékelési súlyok | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | {érték} · {érték}% · fordított | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Cím | A pontszám még nem elérhető | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Adj meg mind a hat értékelési szempontot a döntési pontszám kiszámításához. | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Indíts vagy fejezz be kezdő felmérést a felkészültségi adatokhoz. | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Az aktuális kezdő felmérés kérdéssémája nem támogatja a felkészültségi értékelést. | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Cím | Értékelés eredménye | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Döntési pontszám | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | {érték} · {érték} | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Ajánlás | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Felkészültség | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | {érték}% | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Látható szöveg | Becslést blokkoló hiányok | apps/web/src/app/projects/decision-review/decision-review.component.html |
| Döntési értékelés | Címke | Üzleti érték | apps/web/src/app/projects/decision-review/decision-review.component.ts:28 |
| Döntési értékelés | Címke | Stratégiai illeszkedés | apps/web/src/app/projects/decision-review/decision-review.component.ts:29 |
| Döntési értékelés | Címke | Sürgősség | apps/web/src/app/projects/decision-review/decision-review.component.ts:30 |
| Döntési értékelés | Címke | Bizonyosság | apps/web/src/app/projects/decision-review/decision-review.component.ts:31 |
| Döntési értékelés | Címke | Komplexitás | apps/web/src/app/projects/decision-review/decision-review.component.ts:32 |
| Döntési értékelés | Címke | Kockázat | apps/web/src/app/projects/decision-review/decision-review.component.ts:33 |
| Döntési értékelés | Címke | Pontosítás szükséges | apps/web/src/app/projects/decision-review/decision-review.component.ts:37 |
| Döntési értékelés | Címke | Becslés előkészíthető | apps/web/src/app/projects/decision-review/decision-review.component.ts:38 |
| Döntési értékelés | Címke | Becslésre kész | apps/web/src/app/projects/decision-review/decision-review.component.ts:39 |
| Felkészültség | Címke | Üzleti | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:7 |
| Felkészültség | Címke | Terjedelem | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:8 |
| Felkészültség | Címke | Technikai | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:9 |
| Felkészültség | Címke | Adatok | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:10 |
| Felkészültség | Címke | Integráció | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:11 |
| Felkészültség | Címke | Biztonság | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:12 |
| Felkészültség | Címke | Üzemeltetés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:13 |
| Felkészültség | Címke | Egyéb | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:14 |
| Felkészültség | Futásidejű UI-szöveg | betölteni az utánkövetéseket | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:27 |
| Felkészültség | Futásidejű UI-szöveg | betölteni a kezdő felmérés forrásait | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:28 |
| Felkészültség | Futásidejű UI-szöveg | létrehozni az utánkövetést | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:29 |
| Felkészültség | Futásidejű UI-szöveg | menteni az utánkövetés módosításait | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:30 |
| Felkészültség | Futásidejű UI-szöveg | módosítani az utánkövetés forrását | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:31 |
| Felkészültség | Futásidejű UI-szöveg | lezárni az utánkövetést | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:32 |
| Felkészültség | Hiba és helyreállítás | DiscoveryFollowUpsApiError | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:42 |
| Felkészültség | Hiba és helyreállítás | Nem sikerült {érték}. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:165 |
| Felkészültség | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:182 |
| Felkészültség | Hiba és helyreállítás | Nem sikerült {érték}. {érték} | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:194 |
| Felkészültség | Futásidejű UI-szöveg | Térj vissza az Áttekintőre, és ellenőrizd, hogy a projekt még létezik-e. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:210 |
| Felkészültség | Futásidejű UI-szöveg | A projekt archiválva lett vagy időközben megváltozott. Töltsd újra az oldalt, majd próbáld meg ismét. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:213 |
| Felkészültség | Futásidejű UI-szöveg | Az utánkövetés időközben megváltozhatott. Töltsd be az aktuális verziót, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:216 |
| Felkészültség | Futásidejű UI-szöveg | A kezdő felmérés forráslistája frissült. Válassz újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:219 |
| Felkészültség | Futásidejű UI-szöveg | Frissítsd a projektet a legújabb életciklus-állapot megjelenítéséhez. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:222 |
| Felkészültség | Futásidejű UI-szöveg | Válassz kategóriát, töltsd ki a kötelező mezőket és adj meg valós határidőt. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:225 |
| Felkészültség | Futásidejű UI-szöveg | Ellenőrizd a megadott értékeket, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:228 |
| Felkészültség | Futásidejű UI-szöveg | Frissítsd az utánkövetéseket, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:230 |
| Felkészültség | Művelet | Tisztázási tételek újratöltése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Forráslista újrapróbálása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Utánkövetés létrehozása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Szerkesztés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Lezárás | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Forrás hozzárendelése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Forrás módosítása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Forráshivatkozás törlése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Forrás mentése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Mégse | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Módosítások mentése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Aktuális verzió betöltése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Frissítés újrapróbálása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Művelet | Lezárás mentése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Tisztázási utánkövetések | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Rögzítsd a tisztázandó kérdést, a felelősét, a határidejét és a következő lépést. Az archivált projektek adatai olvashatók maradnak. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | A tisztázási utánkövetések betöltése… | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Új tisztázási utánkövetés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Kategória | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | Válassz kategóriát. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Tisztázandó kérdés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A kérdés legfeljebb 10 000 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A kérdés megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Felelős | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A felelős neve legfeljebb 255 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A felelős megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Határidő | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | Adj meg valós határidőt. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Kezdő felmérési forrás (opcionális) | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A kezdő felmérés forrásainak betöltése… | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | Nincs elérhető kezdő felmérési forrás. Az utánkövetés hivatkozás nélkül is létrehozható. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Következő lépés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A következő lépés legfeljebb 10 000 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A következő lépés megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Még nincs rögzített tisztázási utánkövetés. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Ez az utánkövetés egy ügyfél-emlékeztetőre érkezett válasz áttekintési kontextusa. Az emlékeztető a {érték}. forrásverzióhoz tartozik. A válasz nem módosította és nem zárta le automatikusan az utánkövetést. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Felelős: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Következő lépés: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Döntés vagy válasz: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | Forrás: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | #{érték} · {érték} · {érték} | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Kezdő felmérési forrás | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Tisztázási utánkövetés szerkesztése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | A lezárt utánkövetés már nem szerkeszthető. Vesd el ezt a piszkozatot. Az utánkövetés időközben megváltozott. A piszkozat megmaradt; mentés előtt töltsd be az aktuális verziót. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Tisztázási utánkövetés lezárása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Lezárás módja | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | Válaszd ki a lezárás módját. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Mező | Döntés vagy válasz | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A döntés vagy válasz legfeljebb 10 000 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Súgó | A döntés vagy válasz megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Cím | Törlöd a forráshivatkozást? | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Látható szöveg | A rögzített eredet megszűnik. Egy későbbi felmérési kör után előfordulhat, hogy a régi forrás már nem rendelhető vissza. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Felkészültség | Futásidejű UI-szöveg | Az utánkövetés létrejött. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:374 |
| Felkészültség | Futásidejű UI-szöveg | Az utánkövetés forrása frissült. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:446 |
| Felkészültség | Futásidejű UI-szöveg | A forrás nem távolítható el, amíg egy másik projektművelet folyamatban van. Várd meg a befejezését, majd próbáld meg ismét. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:525 |
| Felkészültség | Futásidejű UI-szöveg | A forráshivatkozás nem törölhető, mert az utánkövetés már nem nyitott vagy nincs hozzárendelt forrása. Frissítsd az utánkövetéseket, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:535 |
| Felkészültség | Futásidejű UI-szöveg | discovery follow-up row | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:550 |
| Felkészültség | Futásidejű UI-szöveg | Az utánkövetés forráshivatkozása törölve. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:573 |
| Felkészültség | Futásidejű UI-szöveg | Az utánkövetés módosításai mentve. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:697 |
| Felkészültség | Hiba és helyreállítás | Az utánkövetés időközben megváltozott. A piszkozat megmaradt; mentés előtt töltsd be az aktuális verziót. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:708 |
| Felkészültség | Futásidejű UI-szöveg | Az utánkövetés frissítés után nem található. Mentés előtt próbáld újra a frissítést. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:754 |
| Felkészültség | Futásidejű UI-szöveg | A lezárt utánkövetés már nem szerkeszthető. Vesd el ezt a piszkozatot. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:761 |
| Felkészültség | Futásidejű UI-szöveg | Az utánkövetés lezárva. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:884 |
| Felkészültség | Futásidejű UI-szöveg | Escape | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:1079 |
| Felkészültség | Művelet | Kapcsolódó tisztázási tétel áttekintése | apps/web/src/app/projects/discovery-follow-ups/discovery-reply-outcome.component.ts |
| Utánkövetések | Látható szöveg | Portfólió | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Látható szöveg | A nyitott tisztázási tételek az összes aktív projektből, határidő szerint rendezve. | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Művelet | Áttekintő megnyitása | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Látható szöveg | Az utánkövetések betöltése… | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Cím | Az utánkövetések most nem tölthetők be | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Művelet | Utánkövetések újratöltése | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Cím | Nincs nyitott utánkövetés | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Látható szöveg | Jelenleg egyik aktív projektnél sincs tisztázásra váró kérdés. | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Látható szöveg | {érték} nyitott utánkövetés | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Látható szöveg | Felelős | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Látható szöveg | Határidő | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Látható szöveg | Következő lépés | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Művelet | Utánkövetés megnyitása | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Utánkövetések | Hiba és helyreállítás | Az utánkövetések nem tölthetők be. Próbáld meg újra. | apps/web/src/app/projects/open-discovery-follow-ups.page.ts:52 |
| Utánkövetések | Futásidejű UI-szöveg | Az utánkövetések ismét elérhetők. | apps/web/src/app/projects/open-discovery-follow-ups.page.ts:64 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a projekteket | apps/web/src/app/projects/project-api.service.ts:27 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a projektportfóliót | apps/web/src/app/projects/project-api.service.ts:33 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | létrehozni a projektet | apps/web/src/app/projects/project-api.service.ts:39 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | menteni a projekt alapadatait | apps/web/src/app/projects/project-api.service.ts:51 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a projektbeállításokat | apps/web/src/app/projects/project-api.service.ts:59 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a projekt felkészültségi állapotát | apps/web/src/app/projects/project-api.service.ts:70 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a projekt aktuális feladatát | apps/web/src/app/projects/project-api.service.ts:78 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a legutóbbi projektaktivitást | apps/web/src/app/projects/project-api.service.ts:84 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | betölteni a projektkoordináció szerkesztési adatait | apps/web/src/app/projects/project-api.service.ts:97 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | menteni a projektkoordinációt | apps/web/src/app/projects/project-api.service.ts:111 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | archiválni a projektet | apps/web/src/app/projects/project-api.service.ts:126 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | visszaállítani a projektet | apps/web/src/app/projects/project-api.service.ts:135 |
| Megosztott felületi szöveg | Futásidejű UI-szöveg | végleg törölni a projektet | apps/web/src/app/projects/project-api.service.ts:152 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a hálózati kapcsolatot, majd próbáld újra. | apps/web/src/app/projects/project-api.service.ts:164 |
| Megosztott felületi szöveg | Hiba és helyreállítás | A projekt már tartalmaz megőrzendő munkát, ezért nem törölhető. Archiváld inkább. | apps/web/src/app/projects/project-api.service.ts:179 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Töltsd újra a projektet, ellenőrizd a legfrissebb állapotát, majd ismételd meg a műveletet. | apps/web/src/app/projects/project-api.service.ts:181 |
| Megosztott felületi szöveg | Hiba és helyreállítás | A szolgáltatás átmenetileg nem érhető el. Várj röviden, majd próbáld újra. | apps/web/src/app/projects/project-api.service.ts:185 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Térj vissza a projektlistához, és ellenőrizd, hogy a projekt még létezik-e. | apps/web/src/app/projects/project-api.service.ts:189 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Ellenőrizd a megadott értékeket, majd próbáld újra. | apps/web/src/app/projects/project-api.service.ts:193 |
| Megosztott felületi szöveg | Hiba és helyreállítás | Frissítsd az oldalt, majd próbáld újra. Ha a hiba megmarad, jelezd az üzemeltetőnek. | apps/web/src/app/projects/project-api.service.ts:196 |
| Projektkörnyezet | Akadálymentes név | Kiválasztott projekt | apps/web/src/app/projects/project-context/project-context.page.html |
| Projektkörnyezet | Akadálymentes név | Projektkörnyezet navigációja | apps/web/src/app/projects/project-context/project-context.page.html |
| Projektkörnyezet | Látható szöveg | Projektkörnyezet | apps/web/src/app/projects/project-context/project-context.page.html |
| Projektkörnyezet | Látható szöveg | Projekt | apps/web/src/app/projects/project-context/project-context.page.html |
| Projektkörnyezet | Látható szöveg | Projektkörnyezet betöltése… | apps/web/src/app/projects/project-context/project-context.page.html |
| Projektkörnyezet | Művelet | Projektkörnyezet újratöltése | apps/web/src/app/projects/project-context/project-context.page.html |
| Projektkörnyezet | Látható szöveg | Most ezt intézd | apps/web/src/app/projects/project-context/project-context.page.html |
| Projektkörnyezet | Címke | Projektállapot | apps/web/src/app/projects/project-context/project-context.page.ts:23 |
| Projektkörnyezet | Címke | Felmérés | apps/web/src/app/projects/project-context/project-context.page.ts:24 |
| Projektkörnyezet | Címke | Felkészültség | apps/web/src/app/projects/project-context/project-context.page.ts:25 |
| Projektkörnyezet | Címke | Döntési értékelés | apps/web/src/app/projects/project-context/project-context.page.ts:26 |
| Projektkörnyezet | Címke | Markdown terv | apps/web/src/app/projects/project-context/project-context.page.ts:27 |
| Projektkörnyezet | Címke | Projektbeállítások | apps/web/src/app/projects/project-context/project-context.page.ts:28 |
| Projektkörnyezet | Címke | Vissza a folyamatban lévő ügyekhez | apps/web/src/app/projects/project-context/project-context.page.ts:72 |
| Projektkörnyezet | Címke | Vissza az utánkövetésekhez | apps/web/src/app/projects/project-context/project-context.page.ts:75 |
| Projektkörnyezet | Címke | Vissza az Áttekintőre | apps/web/src/app/projects/project-context/project-context.page.ts:77 |
| Projektkörnyezet | Futásidejű UI-szöveg | A projekt azonosítója hiányzik az útvonalból. | apps/web/src/app/projects/project-context/project-context.state.ts:34 |
| Új projekt | Művelet | Piszkozat mentése és kilépés | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Művelet | Mentés és tovább a felméréshez | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | Projektindítás | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | Add meg az alapadatokat, majd indítsd el a projektfelmérést. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | Projekt alapadatai | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | A kapcsolattartó adatai szükségesek a projekt elindításához. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Adj meg legfeljebb 255 karakteres projektnevet. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Add meg a projektet vezető belső PO/PM nevét. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Add meg az ügyfél kapcsolattartójának nevét. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Adj meg érvényes e-mail-címet. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Művelet | Mégse | apps/web/src/app/projects/project-create.page.html |
| Áttekintő | Művelet | Üzenetek frissítése | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Művelet | Projektlista újratöltése | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | Portfólió | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | Az aktív projektek és a következő feladatok áttekintése. | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Művelet | Folyamatban lévő ügyek | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Művelet | Új projekt | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | Ügyfélkommunikáció | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Cím | Ügyfélpostafiók | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | Postafiók állapotának betöltése… | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Súgó | Utolsó sikeres frissítés: {érték} | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Művelet | Nem társított üzenetek | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | A projektek betöltése… | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Cím | A projektek nem tölthetők be | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Cím | Még nincs projekt | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | Hozd létre az első projektet a munka és a következő lépések követéséhez. | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Művelet | Új projekt létrehozása | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | {érték} új ügyfélválasz | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | Következő lépés felelőse | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Látható szöveg | Következő lépés | apps/web/src/app/projects/project-list.page.html |
| Áttekintő | Címke | Postafiók nincs konfigurálva | apps/web/src/app/projects/project-list.page.ts:103 |
| Áttekintő | Címke | Postafiók kapcsolódása folyamatban | apps/web/src/app/projects/project-list.page.ts:104 |
| Áttekintő | Címke | Postafiók naprakész | apps/web/src/app/projects/project-list.page.ts:105 |
| Áttekintő | Címke | Postafiók-szinkron késik | apps/web/src/app/projects/project-list.page.ts:106 |
| Áttekintő | Címke | Postafiók átmenetileg nem érhető el | apps/web/src/app/projects/project-list.page.ts:107 |
| Áttekintő | Hiba és helyreállítás | Postafiók-beállítás javítandó | apps/web/src/app/projects/project-list.page.ts:108 |
| Áttekintő | Hiba és helyreállítás | Postafiók-jogosultság javítandó | apps/web/src/app/projects/project-list.page.ts:109 |
| Projektbeállítások | Művelet | Projektbeállítások újratöltése | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Projekt visszaállítása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Projekt archiválása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Projekt végleges törlése | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Mégse | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A projektbeállítások betöltése… | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | A projektbeállítások nem tölthetők be | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Projektadminisztráció | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A projekt azonosító adatai, ügyfélkapcsolati beállításai és életciklus-műveletei. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Az archivált projekt beállításai olvashatók. Módosításhoz előbb állítsd vissza a projektet. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Projekt alapadatai | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A kérdésséma elfogadásáig az alapadatok még módosíthatók. Az elfogadott kérdésséma után az alapadatok csak olvashatók. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Projekt neve | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Belső PO/PM neve | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Ügyfélkapcsolattartó neve | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Ügyfélkapcsolattartó e-mail-címe | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Minden alapadatot érvényesen tölts ki a mentéshez. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Projekt életciklusa | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Az adminisztratív állapot azt jelzi, hol tart vagy mire vár a projekt. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Jelenlegi életciklus-állapot | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Archivált | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Életciklus-állapot | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Veszélyzóna | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Életciklus-műveletek, amelyek kiveszik a projektet az aktív munkából vagy végleg törlik. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | Projekt visszaállítása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A napi munka és a módosítások ismét elérhetővé válnak. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | Projekt archiválása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Az adatok megmaradnak, de a projekt kikerül az aktív munkából és csak olvasható lesz. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | Projekt végleges törlése | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Csak mentett projektmunka nélküli piszkozat törölhető. A művelet nem vonható vissza. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt azonosítója hiányzik az útvonalból. | apps/web/src/app/projects/project-settings.page.ts:117 |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt alapadatai mentve lettek. | apps/web/src/app/projects/project-settings.page.ts:167 |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt életciklus-állapota frissítve lett. | apps/web/src/app/projects/project-settings.page.ts:190 |
| Projektbeállítások | Futásidejű UI-szöveg | Projekt archiválása | apps/web/src/app/projects/project-settings.page.ts:201 |
| Projektbeállítások | Futásidejű UI-szöveg | Az archivált projekt kikerül az aktív munkából, és a módosításai letiltásra kerülnek. Az adatok olvashatók és később visszaállíthatók maradnak. | apps/web/src/app/projects/project-settings.page.ts:202 |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt archiválva lett. | apps/web/src/app/projects/project-settings.page.ts:220 |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt visszaállt Előkészítés alatt állapotba. | apps/web/src/app/projects/project-settings.page.ts:239 |
| Projektbeállítások | Futásidejű UI-szöveg | Projekt végleges törlése | apps/web/src/app/projects/project-settings.page.ts:250 |
| Projektbeállítások | Futásidejű UI-szöveg | A törlés nem vonható vissza, és csak mentett projektmunka nélküli piszkozatnál hajtható végre. | apps/web/src/app/projects/project-settings.page.ts:251 |
| Projektállapot | Címke | Előkészítés alatt | apps/web/src/app/projects/project-status-label.ts:6 |
| Projektállapot | Címke | Felmérés folyamatban | apps/web/src/app/projects/project-status-label.ts:7 |
| Projektállapot | Címke | Belső feladatra vár | apps/web/src/app/projects/project-status-label.ts:8 |
| Projektállapot | Címke | Ügyfélre vár | apps/web/src/app/projects/project-status-label.ts:9 |
| Projektállapot | Címke | Becslésre kész | apps/web/src/app/projects/project-status-label.ts:10 |
| Projektállapot | Címke | Archivált | apps/web/src/app/projects/project-status-label.ts:14 |
| Projektállapot | Művelet | Projektállapot újratöltése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Mezősúgó | Válassz felelőst | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Szerkesztési adatok újratöltése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Aktivitás újratöltése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Projektkörnyezet | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | A napi projektmunka következő lépése, ügyféllevelezése és legutóbbi változásai. | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Projektkoordináció | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | A jelenlegi felelős és a következő konkrét lépés. | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | A projektkoordináció betöltése folyamatban van… | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Következő lépés felelőse | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Következő lépés | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Határidő | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Mező | Következő lépés felelőse | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Mező | Következő lépés | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Súgó | A következő lépés legfeljebb 10 000 karakter lehet. | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Mező | Határidő | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Mégse | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Koordináció mentése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | A szerkesztés előkészítése… | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | A koordináció most nem szerkeszthető. {érték} | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Az archivált projekt koordinációja csak olvasható. A módosításhoz előbb állítsd vissza a projektet a | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Projektbeállításokban | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Koordináció szerkesztése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Ügyféllevelezés | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Az új válaszok állapota és a feldolgozás belépési pontja. | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Az ügyféllevelezés állapotának betöltése… | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Új válaszok | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Teendő | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Ügyféllevelezés kezelése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Legutóbbi aktivitás | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Az utolsó öt, munkához szükséges projektváltozás. | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Az aktivitás betöltése folyamatban van… | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Még nincs megjeleníthető projektaktivitás. | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Címke | PO/PM – {érték} | apps/web/src/app/projects/project-status.page.ts:58 |
| Projektállapot | Címke | Ügyfél – {érték} | apps/web/src/app/projects/project-status.page.ts:63 |
| Projektállapot | Futásidejű UI-szöveg | A projekt azonosítója hiányzik az útvonalból. | apps/web/src/app/projects/project-status.page.ts:91 |
| Projektállapot | Futásidejű UI-szöveg | A projektkoordináció frissítve lett. | apps/web/src/app/projects/project-status.page.ts:162 |
| Megosztott felületi szöveg | Címke | {érték} / {érték} kérdés megválaszolva | apps/web/src/app/projects/project-work-progress-label.ts:8 |
| Megosztott felületi szöveg | Címke | {érték} / {érték} döntési szempont kitöltve | apps/web/src/app/projects/project-work-progress-label.ts:9 |
| Felkészültség | Művelet | Felkészültségi értékelés újratöltése | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Művelet | Projektállapot megnyitása | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Művelet | Kérdés megnyitása | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Művelet | Utánkövetések megnyitása | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | Felkészültségi értékelés | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | Az értékelés a kezdő felmérés, az ellenőrzőlista és a tisztázási utánkövetések aktuális állapotát foglalja össze. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | A felkészültségi értékelés betöltése folyamatban van… | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Cím | Még nincs kezdő felmérés | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | Indíts kezdő felmérést a felkészültségi értékelés elkészítéséhez. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Cím | Az értékeléshez frissített kérdésséma szükséges | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | Frissítsd a projekt kérdéssémáját, majd indíts új kezdő felmérést. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | Felmérés kitöltöttsége | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | {érték}% · {érték} | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | Felkészültség | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Cím | Értékelési tényezők | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | {érték}: {érték}% | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Cím | Rendezendő hiányok | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | Nincs azonosított hiány. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Látható szöveg | {érték} · {érték} | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Felkészültség | Művelet | Utánkövetések újratöltése | apps/web/src/app/projects/readiness.page.html |
| Felkészültség | Látható szöveg | Projektkörnyezet | apps/web/src/app/projects/readiness.page.html |
| Felkészültség | Látható szöveg | A jelenlegi hiányok, tisztázási feladatok és utánkövetések. | apps/web/src/app/projects/readiness.page.html |
| Felkészültség | Látható szöveg | Az utánkövetések betöltése… | apps/web/src/app/projects/readiness.page.html |
| Markdown beállítások | Futásidejű UI-szöveg | betölteni a Markdown-sablonokat | apps/web/src/app/settings/markdown-template-api.service.ts:18 |
| Markdown beállítások | Futásidejű UI-szöveg | létrehozni a Markdown-sablont | apps/web/src/app/settings/markdown-template-api.service.ts:23 |
| Markdown beállítások | Futásidejű UI-szöveg | menteni a Markdown-sablon piszkozatát | apps/web/src/app/settings/markdown-template-api.service.ts:28 |
| Markdown beállítások | Futásidejű UI-szöveg | előnézetet készíteni | apps/web/src/app/settings/markdown-template-api.service.ts:33 |
| Markdown beállítások | Futásidejű UI-szöveg | publikálni a Markdown sablont | apps/web/src/app/settings/markdown-template-api.service.ts:38 |
| Markdown beállítások | Hiba és helyreállítás | Nem sikerült {érték}, mert a sablon időközben megváltozott. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/settings/markdown-template-api.service.ts:45 |
| Markdown beállítások | Hiba és helyreállítás | A Markdown-sablon nem támogatott vagy hibás helyőrzőt tartalmaz. Ellenőrizd a használható helyőrzőket, majd mentsd újra. | apps/web/src/app/settings/markdown-template-api.service.ts:47 |
| Markdown beállítások | Hiba és helyreállítás | Nem sikerült {érték}. Ellenőrizd az adatokat, majd próbáld újra. | apps/web/src/app/settings/markdown-template-api.service.ts:48 |
| Markdown beállítások | Hiba és helyreállítás | Nem sikerült {érték}. Próbáld újra. | apps/web/src/app/settings/markdown-template-api.service.ts:49 |
| Markdown beállítások | Művelet | Sablonok újratöltése | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Művelet | Új sablon | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Művelet | Piszkozat mentése | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Művelet | Előnézet | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Művelet | Publikálás | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | Szervezeti beállítás | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | Névvel ellátott sablonokat szerkeszthetsz, előnézetben ellenőrizhetsz és változatlan publikált verzióként tehetsz elérhetővé. | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | Markdown sablonok betöltése… | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Cím | A sablonok nem tölthetők be | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | Sablonkönyvtár | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Mező | Név | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Mező | Markdown forrás | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | Biztonságos helyőrzők | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | A projektadat-függő blokkok | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | jellel opcionálissá tehetők. Az opcionális helyőrző mindig külön Markdown blokk legyen; ha nincs adat, a közvetlenül előtte álló címsorral együtt kimarad. | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | {érték}' | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | — {érték} · {érték} | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Látható szöveg | Előnézet | apps/web/src/app/settings/markdown-template.page.html |
| Markdown beállítások | Futásidejű UI-szöveg | Piszkozat mentve. Az előnézet után publikálhatod. | apps/web/src/app/settings/markdown-template.page.ts:97 |
| Markdown beállítások | Futásidejű UI-szöveg | A sablon v{érték} verziója publikálva. | apps/web/src/app/settings/markdown-template.page.ts:134 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | betölteni a kérdésbankot | apps/web/src/app/settings/question-bank-api.service.ts:20 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | létrehozni az alapkérdést | apps/web/src/app/settings/question-bank-api.service.ts:26 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | menteni az alapkérdés módosításait | apps/web/src/app/settings/question-bank-api.service.ts:32 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | betölteni a projekt kérdéssémáját | apps/web/src/app/settings/question-bank-api.service.ts:44 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | publikálni a projekt kérdéssémáját | apps/web/src/app/settings/question-bank-api.service.ts:59 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | frissíteni a projekt kérdéssémáját | apps/web/src/app/settings/question-bank-api.service.ts:72 |
| Kérdésbank beállítások | Hiba és helyreállítás | Nem sikerült {érték}. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:98 |
| Kérdésbank beállítások | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:105 |
| Kérdésbank beállítások | Hiba és helyreállítás | Ellenőrizd, hogy a projekt vagy a kérdés még létezik-e. | apps/web/src/app/settings/question-bank-api.service.ts:112 |
| Kérdésbank beállítások | Hiba és helyreállítás | Frissítsd az oldalt a legújabb publikált verzióhoz, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:114 |
| Kérdésbank beállítások | Hiba és helyreállítás | Ellenőrizd a megadott értékeket, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:115 |
| Kérdésbank beállítások | Hiba és helyreállítás | Nem sikerült {érték}. {érték} | apps/web/src/app/settings/question-bank-api.service.ts:117 |
| Kérdésbank beállítások | Művelet | Új alapkérdés | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Művelet | Mégse | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Művelet | Kérdésbank újratöltése | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Művelet | Alapkérdés létrehozása | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Művelet | Szerkesztés | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Szervezeti beállítás | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Az új projektek felmérési kérdéssémájához használható alapkérdések kezelése. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Minden mentés új, megváltoztathatatlan kérdésbankverziót hoz létre. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Kérdésazonosító | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Súgó | Csak kisbetű, szám és kötőjel használható. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Súgó | Add meg a kérdésazonosítót. Legfeljebb 100 kisbetűt, számot vagy kötőjelet használj. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Témakör | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Súgó | Add meg a témakört. A témakör legfeljebb 255 karakter lehet. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Ellenőrzési pont | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Súgó | Add meg az ellenőrzési pontot. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Választípus | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Kérdés szövege | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Súgó | Add meg a kérdés szövegét. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Sorrend | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Súgó | A sorrend nullánál nagyobb egész szám legyen. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Kitöltési segítség (opcionális) | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | Válaszlehetőségek | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Súgó | Soronként egy lehetőséget adj meg. Az üres sorokat a rendszer kihagyja. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Mező | A kérdés használata | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Kötelező | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Becsléshez kötelező | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Hiánya blokkol | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Aktív | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | A kérdésbank betöltése… | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Cím | A kérdésbank nem tölthető be | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Publikált verzió: | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | {érték} kérdés | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Cím | Még nincs alapkérdés | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Adj hozzá egy kérdést, hogy létrehozható legyen a projektek felmérési kérdéssémája. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Témakör | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Ellenőrzési pont | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Sorrend | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Válaszlehetőségek | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Látható szöveg | Kitöltési segítség: | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank beállítások | Futásidejű UI-szöveg | A választós kérdéshez legalább egy válaszlehetőség szükséges. | apps/web/src/app/settings/question-bank.page.ts:180 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | Egy válaszlehetőség csak egyszer szerepelhet. | apps/web/src/app/settings/question-bank.page.ts:184 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | Az alapkérdés módosításai mentve. | apps/web/src/app/settings/question-bank.page.ts:226 |
| Kérdésbank beállítások | Futásidejű UI-szöveg | Az alapkérdés létrejött. | apps/web/src/app/settings/question-bank.page.ts:226 |

Összesen: **972** leltárelem.
