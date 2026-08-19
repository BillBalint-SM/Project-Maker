# Project Work Hub – UI-szövegleltár

> Generált fájl. Módosítás: `scripts/generate-ui-copy-inventory.mjs`, majd `pnpm generate:ui-copy`.

Ez a leltár a munkavállalói felületen megjelenő kanonikus navigációs neveket, címeket, állapotokat, műveleteket, mezőket, súgókat és helyreállítási szövegeket gyűjti össze. A kézzel karbantartott kanonikus szerződés mellett a generátor a teljes alkalmazássablon statikus szövegeit és a TypeScriptből származó magyar futásidejű visszajelzéseket is felsorolja. A kapcsos zárójel dinamikus üzleti adatot jelöl. A technikai azonosítók és a felhasználó által megadott projektadatok nem copy-elemek.

| Képernyő | Kontextus | Javasolt kanonikus szöveg | Forrás |
| --- | --- | --- | --- |
| Alkalmazáskeret | Navigáció | Projektportfólió | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Új projekt | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Aktív munkasor | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Tisztázandó tételek | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Specifikációs sablonok | Kanonikus szerződés |
| Alkalmazáskeret | Navigáció | Kérdésbank | Kanonikus szerződés |
| Alkalmazáskeret | Állapot és művelet | {darab} új ügyfélválasz · Feldolgozás megnyitása | Kanonikus szerződés |
| Projektportfólió | Cím | Projektportfólió | Kanonikus szerződés |
| Projektportfólió | Bevezető | Az aktív projektek és a következő feladatok áttekintése. | Kanonikus szerződés |
| Projektportfólió | Elsődleges művelet | Aktív munkasor | Kanonikus szerződés |
| Projektportfólió | Másodlagos művelet | Új projekt | Kanonikus szerződés |
| Projektportfólió | Betöltés | A projektek betöltése… | Kanonikus szerződés |
| Projektportfólió | Hiba és helyreállítás | A projektek nem tölthetők be · Projektlista újratöltése | Kanonikus szerződés |
| Projektportfólió | Üres állapot | Még nincs projekt · Új projekt létrehozása | Kanonikus szerződés |
| Projektportfólió | Kártyamező | Következő lépés felelőse | Kanonikus szerződés |
| Projektportfólió | Kártyamező | Következő lépés | Kanonikus szerződés |
| Projektportfólió | Ügyfélpostafiók | Utolsó sikeres frissítés · Nem társított üzenetek · Üzenetek frissítése | Kanonikus szerződés |
| Új projekt | Cím | Új projekt | Kanonikus szerződés |
| Új projekt | Bevezető | Add meg az alapadatokat, majd indítsd el a projektfelmérést. | Kanonikus szerződés |
| Új projekt | Mező | Projekt neve | Kanonikus szerződés |
| Új projekt | Mező | Belső projektgazda neve | Kanonikus szerződés |
| Új projekt | Mező | Ügyfél kapcsolattartó neve | Kanonikus szerződés |
| Új projekt | Mező | Ügyfél kapcsolattartó e-mail-címe | Kanonikus szerződés |
| Új projekt | Elsődleges művelet | Mentés és tovább a felméréshez | Kanonikus szerződés |
| Új projekt | Másodlagos művelet | Piszkozat mentése és kilépés | Kanonikus szerződés |
| Új projekt | Kilépés | Mégse | Kanonikus szerződés |
| Aktív munkasor | Cím | Aktív munkasor | Kanonikus szerződés |
| Aktív munkasor | Visszatérés | Vissza a projektportfólióhoz | Kanonikus szerződés |
| Aktív munkasor | Szűrő | Projektnév · Sürgősség · Becslési felkészültség | Kanonikus szerződés |
| Aktív munkasor | Művelet | Lista frissítése · Szűrők törlése | Kanonikus szerződés |
| Aktív munkasor | Betöltés | Az aktív munkasor betöltése… | Kanonikus szerződés |
| Aktív munkasor | Hiba és helyreállítás | Az aktív munkasor nem tölthető be · Lista újratöltése | Kanonikus szerződés |
| Aktív munkasor | Elavult állapot | A lista elavult lehet · Sikertelen lekérés újrapróbálása | Kanonikus szerződés |
| Aktív munkasor | Szűrt üres állapot | Nincs találat · Szűrők törlése | Kanonikus szerződés |
| Aktív munkasor | Üres állapot | Nincs aktív projekt · Új projekt létrehozása | Kanonikus szerződés |
| Tisztázandó tételek | Cím | Tisztázandó tételek | Kanonikus szerződés |
| Tisztázandó tételek | Bevezető | Az összes aktív projekt nyitott tisztázandó tételei, határidő szerint rendezve. | Kanonikus szerződés |
| Tisztázandó tételek | Betöltés | A tisztázandó tételek betöltése folyamatban van… | Kanonikus szerződés |
| Tisztázandó tételek | Hiba és helyreállítás | A tisztázandó tételek most nem tölthetők be · Tisztázandó tételek újratöltése | Kanonikus szerződés |
| Tisztázandó tételek | Üres állapot | Nincs nyitott tisztázandó tétel · Vissza a projektportfólióhoz | Kanonikus szerződés |
| Tisztázandó tételek | Listaelem | Projekt · Kategória · Felelős · Határidő · Következő lépés | Kanonikus szerződés |
| Tisztázandó tételek | Elsődleges művelet | Tisztázandó tételek kezelése | Kanonikus szerződés |
| Projekt | Navigáció | Projektállapot | Kanonikus szerződés |
| Projekt | Navigáció | Felmérés | Kanonikus szerződés |
| Projekt | Navigáció | Becslési felkészültség | Kanonikus szerződés |
| Projekt | Navigáció | Döntési értékelés | Kanonikus szerződés |
| Projekt | Navigáció | Projekt-specifikáció | Kanonikus szerződés |
| Projekt | Navigáció | Projektbeállítások | Kanonikus szerződés |
| Projekt | Visszatérés | Vissza a projektportfólióhoz / az aktív munkasorhoz / a tisztázandó tételekhez | Kanonikus szerződés |
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
| Felmérés | Elsődleges művelet | Felmérés lezárása és hiányok áttekintése | Kanonikus szerződés |
| Felmérés | Másodlagos művelet | Lezárás és felmérési összefoglaló előnézete | Kanonikus szerződés |
| Felmérési összefoglaló | Cím | Ügyfélnek küldött felmérési összefoglalók | Kanonikus szerződés |
| Felmérési összefoglaló | Mező | Feladó · Címzett · Tárgy · Módosítás összefoglalása | Kanonikus szerződés |
| Felmérési összefoglaló | Művelet | Előnézet és küldés · Küldés az ügyfélnek | Kanonikus szerződés |
| Felmérési összefoglaló | Hiba és helyreállítás | A levelezőrendszer elutasította az átadást · Összefoglaló újraküldése | Kanonikus szerződés |
| Felmérési összefoglaló | Bizonytalan eredmény | Ellenőrzés után újrapróbálás | Kanonikus szerződés |
| Becslési felkészültség | Cím | Becslési felkészültség | Kanonikus szerződés |
| Becslési felkészültség | Összegzés | Felmérés kitöltöttsége · Felkészültség | Kanonikus szerződés |
| Becslési felkészültség | Tartalom | Értékelési tényezők · Rendezendő hiányok | Kanonikus szerződés |
| Becslési felkészültség | Hiba és helyreállítás | Felkészültségi értékelés újratöltése | Kanonikus szerződés |
| Becslési felkészültség | Üres állapot | Még nincs kezdő felmérés | Kanonikus szerződés |
| Becslési felkészültség | Tisztázás | Tisztázandó tételek · Új tisztázandó tétel | Kanonikus szerződés |
| Becslési felkészültség | Tisztázási művelet | Módosítások mentése · Tétel lezárása · Forráshivatkozás törlése | Kanonikus szerződés |
| Döntési értékelés | Cím | Döntési értékelés | Kanonikus szerződés |
| Döntési értékelés | Betöltés | A döntési értékelés betöltése folyamatban van… | Kanonikus szerződés |
| Döntési értékelés | Hiba és helyreállítás | Döntési értékelés újratöltése | Kanonikus szerződés |
| Döntési értékelés | Elsődleges művelet | Értékelés mentése | Kanonikus szerződés |
| Projekt-specifikáció | Cím | Projekt-specifikáció | Kanonikus szerződés |
| Projekt-specifikáció | Betöltés | Specifikációverziók betöltése… | Kanonikus szerződés |
| Projekt-specifikáció | Hiba és helyreállítás | A specifikációverziók nem tölthetők be · Verziók újratöltése | Kanonikus szerződés |
| Projekt-specifikáció | Mező | Publikált sablon · Létrehozás oka · Mérföldkő | Kanonikus szerződés |
| Projekt-specifikáció | Elsődleges művelet | Specifikációverzió generálása | Kanonikus szerződés |
| Projekt-specifikáció | Üres állapot | Még nincs specifikációverzió | Kanonikus szerződés |
| Projekt-specifikáció | Részletek | Verziótörténet · Specifikációverzió részletei · Tartalmi előnézet · Markdown letöltése | Kanonikus szerződés |
| Projektbeállítások | Cím | Projektbeállítások | Kanonikus szerződés |
| Projektbeállítások | Szakasz | Projekt alapadatai | Kanonikus szerződés |
| Projektbeállítások | Művelet | Alapadatok mentése | Kanonikus szerződés |
| Projektbeállítások | Szakasz | Automatikus ügyfél-emlékeztető | Kanonikus szerződés |
| Projektbeállítások | Művelet | Emlékeztető beállításainak mentése | Kanonikus szerződés |
| Projektbeállítások | Szakasz | Adminisztratív projektfázis | Kanonikus szerződés |
| Projektbeállítások | Művelet | Adminisztratív projektfázis mentése | Kanonikus szerződés |
| Projektbeállítások | Adminisztratív projektfázis | Előkészítés alatt | Kanonikus szerződés |
| Projektbeállítások | Adminisztratív projektfázis | Felmérési szakasz | Kanonikus szerződés |
| Projektbeállítások | Adminisztratív projektfázis | Belső egyeztetésre vár | Kanonikus szerződés |
| Projektbeállítások | Adminisztratív projektfázis | Ügyfél-visszajelzésre vár | Kanonikus szerződés |
| Projektbeállítások | Adminisztratív projektfázis | Tervezésre átadva | Kanonikus szerződés |
| Projektbeállítások | Archiválás és törlés | Projekt visszaállítása · Projekt archiválása · Projekt végleges törlése | Kanonikus szerződés |
| Projektbeállítások | Hiba és helyreállítás | A projektbeállítások nem tölthetők be · Projektbeállítások újratöltése | Kanonikus szerződés |
| Ügyféllevelezés | Cím | Ügyféllevelezés | Kanonikus szerződés |
| Ügyféllevelezés | Összegzés | {darab} feldolgozatlan ügyfélválasz | Kanonikus szerződés |
| Ügyféllevelezés | Művelet | Átnéztem · Feldolgozás megkezdése · Lezárás | Kanonikus szerződés |
| Ügyféllevelezés | Mező | Kézi besorolás | Kanonikus szerződés |
| Ügyféllevelezés | Betöltés | Az ügyféllevelezés betöltése folyamatban van… | Kanonikus szerződés |
| Ügyféllevelezés | Hiba és helyreállítás | Az ügyféllevelezés most nem tölthető be · Ügyféllevelezés újratöltése | Kanonikus szerződés |
| Ügyféllevelezés | Üres állapot | Még nincs ügyfélválasz · Felmérési összefoglaló előkészítése | Kanonikus szerződés |
| Ügyfél-emlékeztető | Cím | Ügyfél-emlékeztető | Kanonikus szerződés |
| Ügyfél-emlékeztető | Mező | Üzenet az ügyfélnek · Kapcsolódó nyitott tisztázandó tétel · Feladó | Kanonikus szerződés |
| Ügyfél-emlékeztető | Művelet | Piszkozat mentése · Küldési előnézet · Küldés az ügyfélnek | Kanonikus szerződés |
| Ügyfél-emlékeztető | Kézbesítési állapot | Még nem történt küldés · Sikeresen elküldve · Sikertelen küldés | Kanonikus szerződés |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Ügyfél-emlékeztető újratöltése · Küldés újrapróbálása | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Cím | Nem társított ügyfélüzenetek | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Mező | Ügyféllevelezés | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Művelet | Üzenet társítása · Nem releváns | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Üres állapot | Nincs feldolgozandó, nem társított üzenet. | Kanonikus szerződés |
| Nem társított ügyfélüzenetek | Hiba és helyreállítás | Üzenetek újratöltése | Kanonikus szerződés |
| Specifikációs sablonok | Cím | Specifikációs sablonok | Kanonikus szerződés |
| Specifikációs sablonok | Művelet | Új sablon · Piszkozat mentése · Előnézet · Publikálás | Kanonikus szerződés |
| Specifikációs sablonok | Hiba és helyreállítás | A sablonok nem tölthetők be · Sablonok újratöltése | Kanonikus szerződés |
| Kérdésbank | Cím | Kérdésbank | Kanonikus szerződés |
| Kérdésbank | Mező | Kérdésazonosító · Témakör · Kérdés · Típus · Sorrend | Kanonikus szerződés |
| Kérdésbank | Művelet | Új alapkérdés · Alapkérdés létrehozása · Módosítások mentése | Kanonikus szerződés |
| Kérdésbank | Üres állapot | Még nincs alapkérdés | Kanonikus szerződés |
| Kérdésbank | Hiba és helyreállítás | A kérdésbank nem tölthető be · Kérdésbank újratöltése | Kanonikus szerződés |
| Alkalmazáskeret | Akadálymentes név | Project Maker projektportfólió | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Akadálymentes név | Fő navigáció | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Látható szöveg | PM | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Látható szöveg | Project Maker | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Súgó | Napi projektmunka egy helyen | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Projektportfólió | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Új projekt | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Aktív munkasor | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Tisztázandó tételek | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Specifikációs sablonok | apps/web/src/app/app.component.ts |
| Alkalmazáskeret | Művelet | Kérdésbank | apps/web/src/app/app.component.ts |
| Megosztott felületi szöveg | Címke | Projektportfólió \| Project Maker | apps/web/src/app/app.routes.ts:10 |
| Megosztott felületi szöveg | Címke | Új projekt \| Project Maker | apps/web/src/app/app.routes.ts:18 |
| Megosztott felületi szöveg | Címke | Aktív munkasor \| Project Maker | apps/web/src/app/app.routes.ts:26 |
| Megosztott felületi szöveg | Címke | Tisztázandó tételek \| Project Maker | apps/web/src/app/app.routes.ts:34 |
| Megosztott felületi szöveg | Címke | Nem társított ügyfélüzenetek \| Project Maker | apps/web/src/app/app.routes.ts:42 |
| Megosztott felületi szöveg | Címke | Projektállapot \| Project Maker | apps/web/src/app/app.routes.ts:57 |
| Megosztott felületi szöveg | Címke | Felmérés \| Project Maker | apps/web/src/app/app.routes.ts:65 |
| Megosztott felületi szöveg | Címke | Becslési felkészültség \| Project Maker | apps/web/src/app/app.routes.ts:73 |
| Megosztott felületi szöveg | Címke | Döntési értékelés \| Project Maker | apps/web/src/app/app.routes.ts:81 |
| Megosztott felületi szöveg | Címke | Projekt-specifikáció \| Project Maker | apps/web/src/app/app.routes.ts:89 |
| Megosztott felületi szöveg | Címke | Ügyféllevelezés \| Project Maker | apps/web/src/app/app.routes.ts:97 |
| Megosztott felületi szöveg | Címke | Projektbeállítások \| Project Maker | apps/web/src/app/app.routes.ts:105 |
| Megosztott felületi szöveg | Címke | Kérdésbank \| Project Maker | apps/web/src/app/app.routes.ts:120 |
| Megosztott felületi szöveg | Címke | Specifikációs sablonok \| Project Maker | apps/web/src/app/app.routes.ts:128 |
| Megosztott felületi szöveg | Címke | Rövid szöveg | apps/web/src/app/base-question-type-label.ts:7 |
| Megosztott felületi szöveg | Címke | Hosszú szöveg | apps/web/src/app/base-question-type-label.ts:8 |
| Megosztott felületi szöveg | Címke | Egyszeres választás | apps/web/src/app/base-question-type-label.ts:9 |
| Megosztott felületi szöveg | Címke | Többszörös választás | apps/web/src/app/base-question-type-label.ts:10 |
| Megosztott felületi szöveg | Címke | Igen vagy nem | apps/web/src/app/base-question-type-label.ts:11 |
| Megosztott felületi szöveg | Címke | Szám | apps/web/src/app/base-question-type-label.ts:12 |
| Megosztott felületi szöveg | Címke | Dátum | apps/web/src/app/base-question-type-label.ts:13 |
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
| Felmérési összefoglaló | Akadálymentes név | Megnyitott felmérési összefoglaló-verzió | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Ügyfélnek küldött felmérési összefoglalók | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Az elküldött verziók változatlan előzményként megmaradnak. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Az archivált projekt felmérési összefoglalói csak olvashatók. | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Cím | {érték}. verzió – {érték} | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Mező | Módosítás összefoglalása | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Mező | Feladó | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Dedikált postafiók – {érték} &lt;{érték}&gt; | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
| Felmérési összefoglaló | Látható szöveg | Személyes postafiók | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
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
| Felmérési összefoglaló | Művelet | Összefoglaló megtekintése – {érték} | apps/web/src/app/interviews/interview-handoff/interview-handoff.component.html |
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
| Felmérési összefoglaló | Hiba és helyreállítás | Az új összefoglaló-verzió nem indítható. Töltsd újra az adatokat, és ellenőrizd a projekt állapotát. | apps/web/src/app/interviews/interview-handoff/interview-reply-outcome.component.ts:54 |
| Felmérés | Művelet | Felmérési oldal újratöltése | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Felmérés indításának újrapróbálása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Mentés újrapróbálása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Automatikus állapot | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Részben megvan | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Nem releváns | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Indoklás mentése | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Értékelés újrapróbálása | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Felmérés lezárása és hiányok áttekintése | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Művelet | Lezárás és felmérési összefoglaló előnézete | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Projektfelmérés | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Válaszd ki az aktív kérdéseket, fogadd el a kérdéssémát, majd folytasd a kezdő felmérési kört. | apps/web/src/app/interviews/interview.page.html |
| Felmérés | Látható szöveg | Az archivált projekt felmérése és felmérési összefoglalói csak olvashatók. Módosításhoz előbb állítsd vissza a projektet. | apps/web/src/app/interviews/interview.page.html |
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
| Felmérés | Futásidejű UI-szöveg | Hiányzik a projektazonosító a felmérés URL-jéből. Menj vissza a projektportfólióhoz, és nyisd meg újra a felmérést. | apps/web/src/app/interviews/interview.page.ts:116 |
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
| Projekt-specifikáció | Futásidejű UI-szöveg | generálni a specifikációverziót | apps/web/src/app/markdown/markdown-api.service.ts:25 |
| Projekt-specifikáció | Futásidejű UI-szöveg | betölteni a specifikációs sablonokat | apps/web/src/app/markdown/markdown-api.service.ts:32 |
| Projekt-specifikáció | Futásidejű UI-szöveg | betölteni a specifikációverziókat | apps/web/src/app/markdown/markdown-api.service.ts:41 |
| Projekt-specifikáció | Futásidejű UI-szöveg | betölteni a specifikációverziót | apps/web/src/app/markdown/markdown-api.service.ts:51 |
| Projekt-specifikáció | Hiba és helyreállítás | Nem sikerült {érték}. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:83 |
| Projekt-specifikáció | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:90 |
| Projekt-specifikáció | Hiba és helyreállítás | Ellenőrizd, hogy a projekt vagy a specifikációverzió még létezik-e. | apps/web/src/app/markdown/markdown-api.service.ts:97 |
| Projekt-specifikáció | Hiba és helyreállítás | Frissítsd a projektet a legújabb specifikációverzióért, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:100 |
| Projekt-specifikáció | Hiba és helyreállítás | Ellenőrizd a kiválasztott létrehozási okot, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:101 |
| Projekt-specifikáció | Hiba és helyreállítás | Nem sikerült {érték}. {érték} | apps/web/src/app/markdown/markdown-api.service.ts:103 |
| Projekt-specifikáció | Futásidejű UI-szöveg | A kötelező sablonblokk nem áll rendelkezésre: | apps/web/src/app/markdown/markdown-api.service.ts:111 |
| Projekt-specifikáció | Futásidejű UI-szöveg | {érték} Pótold a megnevezett projektadatot, majd próbáld újra. | apps/web/src/app/markdown/markdown-api.service.ts:112 |
| Projekt-specifikáció | Futásidejű UI-szöveg | Archivált projekthez nem hozható létre specifikációverzió | apps/web/src/app/markdown/markdown-api.service.ts:114 |
| Projekt-specifikáció | Futásidejű UI-szöveg | Archivált projekthez nem hozható létre specifikációverzió. Előbb állítsd vissza a projektet a Projektbeállításokban. | apps/web/src/app/markdown/markdown-api.service.ts:115 |
| Projekt-specifikáció | Művelet | Verziók újratöltése | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Mezősúgó | Például: Felmérés lezárva | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Művelet | Specifikációverzió újratöltése | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Generált dokumentum | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Hozz létre változatlan specifikációverziót a projekt aktuális előkészítési adataiból, majd tekintsd át vagy töltsd le Markdown formátumban. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Specifikációverziók betöltése… | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Cím | A specifikációverziók nem tölthetők be | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Új specifikációverzió generálása | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | A projekt- és felmérési adatok változatlan forráspillanatképként kerülnek a specifikációverzióba. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Mező | Publikált sablon | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | {érték} · v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Súgó | A sikeres generálás után ezt a választást jegyzi meg a projekt. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Mező | Létrehozás oka | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Súgó | Válassz mérföldkő-okot, ha a pillanatkép egy névvel ellátott átadási ellenőrzési pontot rögzít. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Mező | Mérföldkő | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Súgó | Csak mérföldkő-verziónál kötelező; kézi generálásnál hagyd üresen. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Súgó | Add meg a mérföldkő nevét. A mérföldkő legfeljebb 255 karakter lehet. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Verziótörténet | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | A legújabb specifikációverzió jelenik meg elsőként. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Cím | Még nincs specifikációverzió | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Generáld az első verziót a letölthető kanonikus specifikációhoz. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Specifikációverzió v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Súgó | {érték}{érték} | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Specifikációverzió részletei | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | A specifikációverzió részleteinek betöltése… | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Cím | A specifikációverzió részletei nem tölthetők be | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Változatlan pillanatkép | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Cím | Specifikációverzió v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Létrehozva | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Mérföldkő | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Forrásverzió | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | v{érték} | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Sablon | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | {érték} · v{érték} Korábbi, eredethivatkozás nélküli specifikációverzió | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Előző verzió | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Művelet | Előző verzió megtekintése | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Első verzió | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Cím | Változásösszefoglaló | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Művelet | Markdown letöltése | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Cím | Tartalmi előnézet | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Cím | Válassz specifikációverziót | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Látható szöveg | Válassz egy verziót a történetből a forrás és a tartalom megtekintéséhez. | apps/web/src/app/markdown/markdown.page.html |
| Projekt-specifikáció | Címke | Kézi generálás | apps/web/src/app/markdown/markdown.page.ts:33 |
| Projekt-specifikáció | Címke | Mérföldkő elérése | apps/web/src/app/markdown/markdown.page.ts:33 |
| Projekt-specifikáció | Hiba és helyreállítás | betölteni a specifikációs sablonokat | apps/web/src/app/markdown/markdown.page.ts:108 |
| Projekt-specifikáció | Futásidejű UI-szöveg | A projekt-specifikáció URL-jéből hiányzik a projektazonosító. Térj vissza a projektállapothoz, majd nyisd meg újra a Projekt-specifikációt. | apps/web/src/app/markdown/markdown.page.ts:115 |
| Projekt-specifikáció | Hiba és helyreállítás | betölteni a specifikációverziókat | apps/web/src/app/markdown/markdown.page.ts:139 |
| Projekt-specifikáció | Futásidejű UI-szöveg | A mérföldkő-verzió generálása előtt add meg a mérföldkő nevét. | apps/web/src/app/markdown/markdown.page.ts:154 |
| Projekt-specifikáció | Futásidejű UI-szöveg | A specifikációverzió v{érték} elkészült. | apps/web/src/app/markdown/markdown.page.ts:170 |
| Projekt-specifikáció | Hiba és helyreállítás | generálni a specifikációverziót | apps/web/src/app/markdown/markdown.page.ts:176 |
| Projekt-specifikáció | Hiba és helyreállítás | betölteni a specifikációverziót | apps/web/src/app/markdown/markdown.page.ts:233 |
| Aktív munkasor | Mezősúgó | Keresés projektnévben | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Akadálymentes név | Az aktív munkasor lapozása | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | ← Vissza a projektportfólióhoz | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Portfólió | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Az aktív projektek következő teendői sürgősség szerint rendezve. | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Cím | Lista szűrése | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Projektnév | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Mező | Sürgősség | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | {érték} ({érték}) | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Mező | Becslési felkészültség | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Lista frissítése | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Utolsó lekérés: {érték} | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Cím | A lista elavult lehet. | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Sikertelen lekérés újrapróbálása | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Az aktív munkasor betöltése… | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Cím | Az aktív munkasor nem tölthető be | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Lista újratöltése | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Cím | Nincs találat | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Nincs a keresésnek és a kiválasztott szűrőknek megfelelő aktív projekt. | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Szűrők törlése | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Cím | Nincs aktív projekt | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | A listában minden nem archivált projekt megjelenik. | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Vissza a projektportfólióhoz | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Új projekt létrehozása | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | {érték} projekt látható az összesen {érték} aktív projektből | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Frissítés folyamatban… | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | {érték} látható, összesen {érték} projekt | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Következő lépés | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Felelős | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Határidő | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Új válaszok | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Látható szöveg | Előrehaladás | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Előző oldal | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Művelet | Következő oldal | apps/web/src/app/projects/active-project-queue.page.html |
| Aktív munkasor | Futásidejű UI-szöveg | Új ügyfélválasz | apps/web/src/app/projects/active-project-queue.page.ts:41 |
| Aktív munkasor | Futásidejű UI-szöveg | Lejárt | apps/web/src/app/projects/active-project-queue.page.ts:42 |
| Aktív munkasor | Futásidejű UI-szöveg | Hamarosan lejár | apps/web/src/app/projects/active-project-queue.page.ts:43 |
| Aktív munkasor | Futásidejű UI-szöveg | Folyamatban | apps/web/src/app/projects/active-project-queue.page.ts:44 |
| Aktív munkasor | Futásidejű UI-szöveg | Kérdésséma szükséges | apps/web/src/app/projects/active-project-queue.page.ts:47 |
| Aktív munkasor | Futásidejű UI-szöveg | Felmérés folyamatban | apps/web/src/app/projects/active-project-queue.page.ts:48 |
| Aktív munkasor | Futásidejű UI-szöveg | Tisztázás szükséges | apps/web/src/app/projects/active-project-queue.page.ts:49 |
| Aktív munkasor | Futásidejű UI-szöveg | Döntési értékelés szükséges | apps/web/src/app/projects/active-project-queue.page.ts:50 |
| Aktív munkasor | Futásidejű UI-szöveg | Becslés előkészíthető | apps/web/src/app/projects/active-project-queue.page.ts:51 |
| Aktív munkasor | Futásidejű UI-szöveg | Becslésre kész | apps/web/src/app/projects/active-project-queue.page.ts:52 |
| Aktív munkasor | Futásidejű UI-szöveg | A korábbi oldal már nem állítható helyre. Az első oldalt mutatjuk. | apps/web/src/app/projects/active-project-queue.page.ts:151 |
| Aktív munkasor | Futásidejű UI-szöveg | Ismeretlen betöltési hiba. | apps/web/src/app/projects/active-project-queue.page.ts:157 |
| Aktív munkasor | Futásidejű UI-szöveg | A lista frissítve. | apps/web/src/app/projects/active-project-queue.page.ts:174 |
| Aktív munkasor | Futásidejű UI-szöveg | A lista ismét elérhető. | apps/web/src/app/projects/active-project-queue.page.ts:176 |
| Aktív munkasor | Futásidejű UI-szöveg | A lista frissítése nem sikerült. A korábbi adatok maradtak láthatók. | apps/web/src/app/projects/active-project-queue.page.ts:183 |
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
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | betölteni az ügyfél-emlékeztetőt | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:34 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | betölteni a hivatkozható tisztázandó tételeket | apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts:45 |
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
| Ügyfél-emlékeztető | Művelet | Küldési előnézet | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Kockázat elfogadása és friss küldés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Küldés az ügyfélnek | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Művelet | Emlékeztető beállításainak mentése | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Akadálymentes név | Ügyfél-emlékeztető állapota | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Akadálymentes név | Ügyféllevelezési műveletek | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Automatikus ügyfél-emlékeztető | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
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
| Ügyfél-emlékeztető | Látható szöveg | A mentett piszkozat vagy a kapcsolódó tisztázandó tétel már nem érvényes. Frissítsd és mentsd a piszkozatot az újraütemezéshez. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Ügyfél-emlékeztető újraküldése | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | A korábbi kézbesítés eredménye bizonytalan; az újraküldés duplikált levelet eredményezhet. A korábbi küldés bizonyítottan sikertelen volt. Indíts új, kézi kézbesítési kísérletet? | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Ügyfél-emlékeztető piszkozata | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Üzenet az ügyfélnek | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Súgó | A szöveg egyszerű szövegként kerül az e-mailbe, legfeljebb 10 000 karakterben. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Kapcsolódó nyitott tisztázandó tétel (nem kötelező) | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Nincs kapcsolódó kérdés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | {érték} · {érték} | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Feladó | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Dedikált postafiók – {érték} &lt;{érték}&gt; | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Személyes postafiók | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Feladó neve | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Feladó pontos @pte.hu címe | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Cím | Ügyfél-emlékeztető előnézete | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Ezt a pontos címzettet és tartalmat küldi el a rendszer. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Címzett | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | {érték} &lt;{érték}&gt; | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Feladó | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | Tárgy | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Látható szöveg | A korábbi küldés eredménye bizonytalan. A friss küldés duplikált levelet eredményezhet; csak a kimenő postafiók ellenőrzése után folytasd. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
| Ügyfél-emlékeztető | Mező | Automatikus ügyfél-emlékeztető beállításai | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html |
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
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | Az automatikus ügyfél-emlékeztető beállításai mentve lettek. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:213 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | Piszkozat mentve. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:246 |
| Ügyfél-emlékeztető | Futásidejű UI-szöveg | Átadva a levelezőrendszernek. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:345 |
| Ügyfél-emlékeztető | Címke | Még nem történt küldés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:443 |
| Ügyfél-emlékeztető | Címke | Sikeresen elküldve | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:444 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Sikertelen küldés | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:445 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | Nincs jelzett hiba | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:450 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | A kézbesítés eredménye bizonytalan. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:452 |
| Ügyfél-emlékeztető | Hiba és helyreállítás | A levelezőrendszer elutasította a küldést. | apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts:454 |
| Nem társított ügyfélüzenetek | Művelet | Üzenetek újratöltése | apps/web/src/app/projects/customer-mail-triage.page.html |
| Nem társított ügyfélüzenetek | Művelet | ← Vissza a projektportfólióhoz | apps/web/src/app/projects/customer-mail-triage.page.html |
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
| Döntési értékelés | Látható szöveg | Projekt | apps/web/src/app/projects/decision-review.page.html |
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
| Becslési felkészültség | Címke | Üzleti | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:7 |
| Becslési felkészültség | Címke | Terjedelem | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:8 |
| Becslési felkészültség | Címke | Technikai | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:9 |
| Becslési felkészültség | Címke | Adatok | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:10 |
| Becslési felkészültség | Címke | Integráció | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:11 |
| Becslési felkészültség | Címke | Biztonság | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:12 |
| Becslési felkészültség | Címke | Üzemeltetés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:13 |
| Becslési felkészültség | Címke | Egyéb | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-up-label.ts:14 |
| Becslési felkészültség | Futásidejű UI-szöveg | betölteni a tisztázandó tételeket | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:27 |
| Becslési felkészültség | Futásidejű UI-szöveg | betölteni a kezdő felmérés forrásait | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:28 |
| Becslési felkészültség | Futásidejű UI-szöveg | létrehozni a tisztázandó tételt | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:29 |
| Becslési felkészültség | Futásidejű UI-szöveg | menteni a tisztázandó tétel módosításait | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:30 |
| Becslési felkészültség | Futásidejű UI-szöveg | módosítani a tisztázandó tétel forrását | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:31 |
| Becslési felkészültség | Futásidejű UI-szöveg | lezárni a tisztázandó tételt | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:32 |
| Becslési felkészültség | Hiba és helyreállítás | Nem sikerült {érték}. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:165 |
| Becslési felkészültség | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:182 |
| Becslési felkészültség | Hiba és helyreállítás | Nem sikerült {érték}. {érték} | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:194 |
| Becslési felkészültség | Futásidejű UI-szöveg | Térj vissza a projektportfólióhoz, és ellenőrizd, hogy a projekt még létezik-e. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:210 |
| Becslési felkészültség | Futásidejű UI-szöveg | A projekt archiválva lett vagy időközben megváltozott. Töltsd újra az oldalt, majd próbáld meg ismét. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:213 |
| Becslési felkészültség | Futásidejű UI-szöveg | A tisztázandó tétel időközben megváltozhatott. Töltsd be az aktuális verziót, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:216 |
| Becslési felkészültség | Futásidejű UI-szöveg | A kezdő felmérés forráslistája frissült. Válassz újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:219 |
| Becslési felkészültség | Futásidejű UI-szöveg | Frissítsd a projektet a legújabb adminisztratív projektfázis megjelenítéséhez. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:222 |
| Becslési felkészültség | Futásidejű UI-szöveg | Válassz kategóriát, töltsd ki a kötelező mezőket és adj meg valós határidőt. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:225 |
| Becslési felkészültség | Futásidejű UI-szöveg | Ellenőrizd a megadott értékeket, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:228 |
| Becslési felkészültség | Futásidejű UI-szöveg | Frissítsd a tisztázandó tételeket, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups-api.service.ts:230 |
| Becslési felkészültség | Művelet | Tisztázandó tételek újratöltése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Forráslista újrapróbálása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Tisztázandó tétel létrehozása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Tisztázandó tételek szerkesztése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Lezárás | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Forrás hozzárendelése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Forrás módosítása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Forráshivatkozás törlése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Forrás mentése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Mégse | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Módosítások mentése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Aktuális verzió betöltése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Frissítés újrapróbálása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Művelet | Lezárás mentése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Tisztázandó tételek | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Rögzítsd a tisztázandó kérdést, a felelősét, a határidejét és a következő lépést. Az archivált projektek adatai olvashatók maradnak. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | A tisztázandó tételek betöltése… | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Új tisztázandó tétel | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Kategória | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | Válassz kategóriát. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Tisztázandó kérdés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A kérdés legfeljebb 10 000 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A kérdés megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Felelős | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A felelős neve legfeljebb 255 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A felelős megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Határidő | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | Adj meg valós határidőt. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Kezdő felmérési forrás (opcionális) | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A kezdő felmérés forrásainak betöltése… | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | Nincs elérhető kezdő felmérési forrás. A tisztázandó tétel hivatkozás nélkül is létrehozható. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Következő lépés | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A következő lépés legfeljebb 10 000 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A következő lépés megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Még nincs rögzített tisztázandó tétel. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Ez a tisztázandó tétel egy ügyfél-emlékeztetőre érkezett válasz áttekintési kontextusa. Az emlékeztető a {érték}. forrásverzióhoz tartozik. A válasz nem módosította és nem zárta le automatikusan a tisztázandó tételt. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Felelős: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Következő lépés: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Döntés vagy válasz: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | Forrás: | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | #{érték} · {érték} · {érték} | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Kezdő felmérési forrás | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Tisztázandó tétel szerkesztése | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | A lezárt tisztázandó tétel már nem szerkeszthető. Vesd el ezt a piszkozatot. A tisztázandó tétel időközben megváltozott. A piszkozat megmaradt; mentés előtt töltsd be az aktuális verziót. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Tisztázandó tétel lezárása | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Lezárás módja | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | Válaszd ki a lezárás módját. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Mező | Döntés vagy válasz | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A döntés vagy válasz legfeljebb 10 000 karakter lehet. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Súgó | A döntés vagy válasz megadása kötelező. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Cím | Törlöd a forráshivatkozást? | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Látható szöveg | A rögzített eredet megszűnik. Egy későbbi felmérési kör után előfordulhat, hogy a régi forrás már nem rendelhető vissza. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.html |
| Becslési felkészültség | Futásidejű UI-szöveg | A tisztázandó tétel létrejött. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:374 |
| Becslési felkészültség | Futásidejű UI-szöveg | A tisztázandó tétel forrása frissült. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:446 |
| Becslési felkészültség | Futásidejű UI-szöveg | A forrás nem távolítható el, amíg egy másik projektművelet folyamatban van. Várd meg a befejezését, majd próbáld meg ismét. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:525 |
| Becslési felkészültség | Futásidejű UI-szöveg | A forráshivatkozás nem törölhető, mert a tisztázandó tétel már nem nyitott vagy nincs hozzárendelt forrása. Frissítsd a tisztázandó tételeket, majd próbáld újra. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:535 |
| Becslési felkészültség | Futásidejű UI-szöveg | A tisztázandó tétel forráshivatkozása törölve. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:573 |
| Becslési felkészültség | Futásidejű UI-szöveg | A tisztázandó tétel módosításai mentve. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:697 |
| Becslési felkészültség | Hiba és helyreállítás | A tisztázandó tétel időközben megváltozott. A piszkozat megmaradt; mentés előtt töltsd be az aktuális verziót. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:708 |
| Becslési felkészültség | Futásidejű UI-szöveg | A tisztázandó tétel frissítés után nem található. Mentés előtt próbáld újra a frissítést. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:754 |
| Becslési felkészültség | Futásidejű UI-szöveg | A lezárt tisztázandó tétel már nem szerkeszthető. Vesd el ezt a piszkozatot. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:761 |
| Becslési felkészültség | Futásidejű UI-szöveg | A tisztázandó tétel lezárva. | apps/web/src/app/projects/discovery-follow-ups/discovery-follow-ups.component.ts:884 |
| Becslési felkészültség | Művelet | Kapcsolódó tisztázandó tétel áttekintése | apps/web/src/app/projects/discovery-follow-ups/discovery-reply-outcome.component.ts |
| Tisztázandó tételek | Látható szöveg | Portfólió | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Látható szöveg | Az összes aktív projekt nyitott tisztázandó tételei, határidő szerint rendezve. | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Művelet | Vissza a projektportfólióhoz | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Látható szöveg | A tisztázandó tételek betöltése… | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Cím | A tisztázandó tételek most nem tölthetők be | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Művelet | Tisztázandó tételek újratöltése | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Cím | Nincs nyitott tisztázandó tétel | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Látható szöveg | Jelenleg egyik aktív projektnél sincs tisztázásra váró kérdés. | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Látható szöveg | {érték} nyitott tisztázandó tétel | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Látható szöveg | Felelős | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Látható szöveg | Határidő | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Látható szöveg | Következő lépés | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Művelet | Tisztázandó tételek kezelése | apps/web/src/app/projects/open-discovery-follow-ups.page.html |
| Tisztázandó tételek | Hiba és helyreállítás | A tisztázandó tételek nem tölthetők be. Próbáld meg újra. | apps/web/src/app/projects/open-discovery-follow-ups.page.ts:52 |
| Tisztázandó tételek | Futásidejű UI-szöveg | A tisztázandó tételek ismét elérhetők. | apps/web/src/app/projects/open-discovery-follow-ups.page.ts:64 |
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
| Projekt | Akadálymentes név | Kiválasztott projekt | apps/web/src/app/projects/project-context/project-context.page.html |
| Projekt | Akadálymentes név | Projekt navigációja | apps/web/src/app/projects/project-context/project-context.page.html |
| Projekt | Látható szöveg | Projekt | apps/web/src/app/projects/project-context/project-context.page.html |
| Projekt | Látható szöveg | Projekt betöltése… | apps/web/src/app/projects/project-context/project-context.page.html |
| Projekt | Művelet | Projekt újratöltése | apps/web/src/app/projects/project-context/project-context.page.html |
| Projekt | Látható szöveg | Következő feladat | apps/web/src/app/projects/project-context/project-context.page.html |
| Projekt | Címke | Projektállapot | apps/web/src/app/projects/project-context/project-context.page.ts:23 |
| Projekt | Címke | Felmérés | apps/web/src/app/projects/project-context/project-context.page.ts:24 |
| Projekt | Címke | Becslési felkészültség | apps/web/src/app/projects/project-context/project-context.page.ts:25 |
| Projekt | Címke | Döntési értékelés | apps/web/src/app/projects/project-context/project-context.page.ts:26 |
| Projekt | Címke | Projekt-specifikáció | apps/web/src/app/projects/project-context/project-context.page.ts:27 |
| Projekt | Címke | Projektbeállítások | apps/web/src/app/projects/project-context/project-context.page.ts:28 |
| Projekt | Címke | Vissza az aktív munkasorhoz | apps/web/src/app/projects/project-context/project-context.page.ts:72 |
| Projekt | Címke | Vissza a tisztázandó tételekhez | apps/web/src/app/projects/project-context/project-context.page.ts:75 |
| Projekt | Címke | Vissza a projektportfólióhoz | apps/web/src/app/projects/project-context/project-context.page.ts:77 |
| Projekt | Futásidejű UI-szöveg | A projekt azonosítója hiányzik az útvonalból. | apps/web/src/app/projects/project-context/project-context.state.ts:34 |
| Új projekt | Művelet | Piszkozat mentése és kilépés | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Művelet | Mentés és tovább a felméréshez | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | Projektindítás | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | Add meg az alapadatokat, majd indítsd el a projektfelmérést. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | Projekt alapadatai | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Látható szöveg | A kapcsolattartó adatai szükségesek a projekt elindításához. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Adj meg legfeljebb 255 karakteres projektnevet. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Add meg a projekt belső projektgazdájának nevét. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Add meg az ügyfél kapcsolattartójának nevét. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Súgó | Adj meg érvényes e-mail-címet. | apps/web/src/app/projects/project-create.page.html |
| Új projekt | Művelet | Mégse | apps/web/src/app/projects/project-create.page.html |
| Projektportfólió | Művelet | Üzenetek frissítése | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Művelet | Projektlista újratöltése | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | Portfólió | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | Az aktív projektek és a következő feladatok áttekintése. | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Művelet | Aktív munkasor | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Művelet | Új projekt | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | Ügyfélkommunikáció | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Cím | Ügyfélpostafiók | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | Postafiók állapotának betöltése… | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Súgó | Utolsó sikeres frissítés: {érték} | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Művelet | Nem társított üzenetek | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | A projektek betöltése… | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Cím | A projektek nem tölthetők be | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Cím | Még nincs projekt | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | Hozd létre az első projektet a munka és a következő lépések követéséhez. | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Művelet | Új projekt létrehozása | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | {érték} új ügyfélválasz | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | Következő lépés felelőse | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Látható szöveg | Következő lépés | apps/web/src/app/projects/project-list.page.html |
| Projektportfólió | Címke | Postafiók nincs konfigurálva | apps/web/src/app/projects/project-list.page.ts:103 |
| Projektportfólió | Címke | Postafiók kapcsolódása folyamatban | apps/web/src/app/projects/project-list.page.ts:104 |
| Projektportfólió | Címke | Postafiók naprakész | apps/web/src/app/projects/project-list.page.ts:105 |
| Projektportfólió | Címke | Postafiók-szinkron késik | apps/web/src/app/projects/project-list.page.ts:106 |
| Projektportfólió | Címke | Postafiók átmenetileg nem érhető el | apps/web/src/app/projects/project-list.page.ts:107 |
| Projektportfólió | Hiba és helyreállítás | Postafiók-beállítás javítandó | apps/web/src/app/projects/project-list.page.ts:108 |
| Projektportfólió | Hiba és helyreállítás | Postafiók-jogosultság javítandó | apps/web/src/app/projects/project-list.page.ts:109 |
| Projektbeállítások | Művelet | Projektbeállítások újratöltése | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Projekt visszaállítása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Projekt archiválása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Projekt végleges törlése | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Művelet | Mégse | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A projektbeállítások betöltése… | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | A projektbeállítások nem tölthetők be | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Projektadminisztráció | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A projekt azonosító adatai, ügyfélkapcsolati beállításai, adminisztratív fázisa, archiválása és törlése. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Az archivált projekt beállításai olvashatók. Módosításhoz előbb állítsd vissza a projektet. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Projekt alapadatai | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A kérdésséma elfogadásáig az alapadatok még módosíthatók. Az elfogadott kérdésséma után az alapadatok csak olvashatók. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Projekt neve | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Belső projektgazda neve | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Ügyfélkapcsolattartó neve | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Ügyfélkapcsolattartó e-mail-címe | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Minden alapadatot érvényesen tölts ki a mentéshez. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Adminisztratív projektfázis | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A kézzel rögzített üzleti fázis azt jelzi, hol tart vagy mire vár a projekt; nem a számított becslési felkészültséget mutatja. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Jelenlegi adminisztratív projektfázis | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Archivált | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Mező | Adminisztratív projektfázis | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Archiválás és törlés | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Műveletek, amelyek kiveszik a projektet az aktív munkából vagy végleg törlik. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | Projekt visszaállítása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | A napi munka és a módosítások ismét elérhetővé válnak. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | Projekt archiválása | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Az adatok megmaradnak, de a projekt kikerül az aktív munkából és csak olvasható lesz. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Cím | Projekt végleges törlése | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Látható szöveg | Csak mentett projektmunka nélküli piszkozat törölhető. A művelet nem vonható vissza. | apps/web/src/app/projects/project-settings.page.html |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt azonosítója hiányzik az útvonalból. | apps/web/src/app/projects/project-settings.page.ts:117 |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt alapadatai mentve lettek. | apps/web/src/app/projects/project-settings.page.ts:167 |
| Projektbeállítások | Futásidejű UI-szöveg | Az adminisztratív projektfázis frissítve lett. | apps/web/src/app/projects/project-settings.page.ts:190 |
| Projektbeállítások | Futásidejű UI-szöveg | Projekt archiválása | apps/web/src/app/projects/project-settings.page.ts:201 |
| Projektbeállítások | Futásidejű UI-szöveg | Az archivált projekt kikerül az aktív munkából, és a módosításai letiltásra kerülnek. Az adatok olvashatók és később visszaállíthatók maradnak. | apps/web/src/app/projects/project-settings.page.ts:202 |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt archiválva lett. | apps/web/src/app/projects/project-settings.page.ts:220 |
| Projektbeállítások | Futásidejű UI-szöveg | A projekt visszaállt az Előkészítés alatt adminisztratív projektfázisba. | apps/web/src/app/projects/project-settings.page.ts:239 |
| Projektbeállítások | Futásidejű UI-szöveg | Projekt végleges törlése | apps/web/src/app/projects/project-settings.page.ts:250 |
| Projektbeállítások | Futásidejű UI-szöveg | A törlés nem vonható vissza, és csak mentett projektmunka nélküli piszkozatnál hajtható végre. | apps/web/src/app/projects/project-settings.page.ts:251 |
| Projektállapot | Művelet | Projektállapot újratöltése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Mezősúgó | Válassz felelőst | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Szerkesztési adatok újratöltése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Művelet | Aktivitás újratöltése | apps/web/src/app/projects/project-status.page.html |
| Projektállapot | Látható szöveg | Projekt | apps/web/src/app/projects/project-status.page.html |
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
| Projektállapot | Címke | Belső projektgazda – {érték} | apps/web/src/app/projects/project-status.page.ts:58 |
| Projektállapot | Címke | Ügyfélkapcsolattartó – {érték} | apps/web/src/app/projects/project-status.page.ts:63 |
| Projektállapot | Futásidejű UI-szöveg | A projekt azonosítója hiányzik az útvonalból. | apps/web/src/app/projects/project-status.page.ts:91 |
| Projektállapot | Futásidejű UI-szöveg | A projektkoordináció frissítve lett. | apps/web/src/app/projects/project-status.page.ts:162 |
| Megosztott felületi szöveg | Címke | {érték} / {érték} kérdés megválaszolva | apps/web/src/app/projects/project-work-progress-label.ts:8 |
| Megosztott felületi szöveg | Címke | {érték} / {érték} döntési szempont kitöltve | apps/web/src/app/projects/project-work-progress-label.ts:9 |
| Becslési felkészültség | Művelet | Felkészültségi értékelés újratöltése | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Művelet | Projektállapot megnyitása | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Művelet | Kérdés megnyitása | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Művelet | Tisztázandó tételek kezelése | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Felkészültségi értékelés | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Az értékelés a kezdő felmérés, az ellenőrzőlista és a tisztázandó tételek aktuális állapotát foglalja össze. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | A felkészültségi értékelés betöltése folyamatban van… | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Cím | Még nincs kezdő felmérés | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Indíts kezdő felmérést a felkészültségi értékelés elkészítéséhez. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Cím | Az értékeléshez frissített kérdésséma szükséges | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Frissítsd a projekt kérdéssémáját, majd indíts új kezdő felmérést. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Felmérés kitöltöttsége | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | {érték}% · {érték} | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Felkészültség | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Cím | Értékelési tényezők | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | {érték}: {érték}% | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Cím | Rendezendő hiányok | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Nincs azonosított hiány. | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | {érték} · {érték} | apps/web/src/app/projects/readiness-review/readiness-review.component.html |
| Becslési felkészültség | Látható szöveg | Projekt | apps/web/src/app/projects/readiness.page.html |
| Becslési felkészültség | Látható szöveg | A jelenlegi hiányok, felkészültségi tényezők és tisztázandó tételek. | apps/web/src/app/projects/readiness.page.html |
| Specifikációs sablonok | Futásidejű UI-szöveg | betölteni a specifikációs sablonokat | apps/web/src/app/settings/markdown-template-api.service.ts:18 |
| Specifikációs sablonok | Futásidejű UI-szöveg | létrehozni a specifikációs sablont | apps/web/src/app/settings/markdown-template-api.service.ts:23 |
| Specifikációs sablonok | Futásidejű UI-szöveg | menteni a specifikációs sablon piszkozatát | apps/web/src/app/settings/markdown-template-api.service.ts:28 |
| Specifikációs sablonok | Futásidejű UI-szöveg | előnézetet készíteni | apps/web/src/app/settings/markdown-template-api.service.ts:33 |
| Specifikációs sablonok | Futásidejű UI-szöveg | publikálni a specifikációs sablont | apps/web/src/app/settings/markdown-template-api.service.ts:38 |
| Specifikációs sablonok | Hiba és helyreállítás | Nem sikerült {érték}, mert a sablon időközben megváltozott. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/settings/markdown-template-api.service.ts:45 |
| Specifikációs sablonok | Hiba és helyreállítás | A specifikációs sablon nem támogatott vagy hibás helyőrzőt tartalmaz. Ellenőrizd a használható helyőrzőket, majd mentsd újra. | apps/web/src/app/settings/markdown-template-api.service.ts:47 |
| Specifikációs sablonok | Hiba és helyreállítás | Nem sikerült {érték}. Ellenőrizd az adatokat, majd próbáld újra. | apps/web/src/app/settings/markdown-template-api.service.ts:48 |
| Specifikációs sablonok | Hiba és helyreállítás | Nem sikerült {érték}. Próbáld újra. | apps/web/src/app/settings/markdown-template-api.service.ts:49 |
| Specifikációs sablonok | Művelet | Sablonok újratöltése | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Művelet | Új sablon | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Művelet | Piszkozat mentése | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Művelet | Előnézet | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Művelet | Publikálás | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | Szervezeti beállítás | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | Névvel ellátott sablonokat szerkeszthetsz, előnézetben ellenőrizhetsz és változatlan publikált verzióként tehetsz elérhetővé. | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | Specifikációs sablonok betöltése… | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Cím | A sablonok nem tölthetők be | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | Sablonkönyvtár | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Mező | Név | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Mező | Markdown forrás | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | Biztonságos helyőrzők | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | A projektadat-függő blokkok | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | jellel opcionálissá tehetők. Az opcionális helyőrző mindig külön Markdown blokk legyen; ha nincs adat, a közvetlenül előtte álló címsorral együtt kimarad. | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | {érték}' | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | — {érték} · {érték} | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Látható szöveg | Előnézet | apps/web/src/app/settings/markdown-template.page.html |
| Specifikációs sablonok | Futásidejű UI-szöveg | Piszkozat mentve. Az előnézet után publikálhatod. | apps/web/src/app/settings/markdown-template.page.ts:97 |
| Specifikációs sablonok | Futásidejű UI-szöveg | A sablon v{érték} verziója publikálva. | apps/web/src/app/settings/markdown-template.page.ts:134 |
| Kérdésbank | Futásidejű UI-szöveg | betölteni a kérdésbankot | apps/web/src/app/settings/question-bank-api.service.ts:20 |
| Kérdésbank | Futásidejű UI-szöveg | létrehozni az alapkérdést | apps/web/src/app/settings/question-bank-api.service.ts:26 |
| Kérdésbank | Futásidejű UI-szöveg | menteni az alapkérdés módosításait | apps/web/src/app/settings/question-bank-api.service.ts:32 |
| Kérdésbank | Futásidejű UI-szöveg | betölteni a projekt kérdéssémáját | apps/web/src/app/settings/question-bank-api.service.ts:44 |
| Kérdésbank | Futásidejű UI-szöveg | publikálni a projekt kérdéssémáját | apps/web/src/app/settings/question-bank-api.service.ts:59 |
| Kérdésbank | Futásidejű UI-szöveg | frissíteni a projekt kérdéssémáját | apps/web/src/app/settings/question-bank-api.service.ts:72 |
| Kérdésbank | Hiba és helyreállítás | Nem sikerült {érték}. Frissítsd az oldalt, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:98 |
| Kérdésbank | Hiba és helyreállítás | Nem sikerült {érték}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:105 |
| Kérdésbank | Hiba és helyreállítás | Ellenőrizd, hogy a projekt vagy a kérdés még létezik-e. | apps/web/src/app/settings/question-bank-api.service.ts:112 |
| Kérdésbank | Hiba és helyreállítás | Frissítsd az oldalt a legújabb publikált verzióhoz, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:114 |
| Kérdésbank | Hiba és helyreállítás | Ellenőrizd a megadott értékeket, majd próbáld újra. | apps/web/src/app/settings/question-bank-api.service.ts:115 |
| Kérdésbank | Hiba és helyreállítás | Nem sikerült {érték}. {érték} | apps/web/src/app/settings/question-bank-api.service.ts:117 |
| Kérdésbank | Művelet | Új alapkérdés | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Művelet | Mégse | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Művelet | Kérdésbank újratöltése | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Művelet | Alapkérdés létrehozása | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Művelet | Alapkérdés szerkesztése | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Szervezeti beállítás | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Az új projektek felmérési kérdéssémájához használható alapkérdések kezelése. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Minden mentés új, megváltoztathatatlan kérdésbankverziót hoz létre. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Kérdésazonosító | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Súgó | Csak kisbetű, szám és kötőjel használható. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Súgó | Add meg a kérdésazonosítót. Legfeljebb 100 kisbetűt, számot vagy kötőjelet használj. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Témakör | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Súgó | Add meg a témakört. A témakör legfeljebb 255 karakter lehet. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Ellenőrzési pont | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Súgó | Add meg az ellenőrzési pontot. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Választípus | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Kérdés szövege | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Súgó | Add meg a kérdés szövegét. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Sorrend | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Súgó | A sorrend nullánál nagyobb egész szám legyen. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Kitöltési segítség (opcionális) | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | Válaszlehetőségek | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Súgó | Soronként egy lehetőséget adj meg. Az üres sorokat a rendszer kihagyja. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Mező | A kérdés használata | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Kötelező | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Becsléshez kötelező | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Hiánya blokkol | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Aktív | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | A kérdésbank betöltése… | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Cím | A kérdésbank nem tölthető be | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Publikált verzió: | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | {érték} kérdés | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Cím | Még nincs alapkérdés | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Adj hozzá egy kérdést, hogy létrehozható legyen a projektek felmérési kérdéssémája. | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Témakör | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Ellenőrzési pont | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Sorrend | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Válaszlehetőségek | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Látható szöveg | Kitöltési segítség: | apps/web/src/app/settings/question-bank.page.html |
| Kérdésbank | Futásidejű UI-szöveg | A választós kérdéshez legalább egy válaszlehetőség szükséges. | apps/web/src/app/settings/question-bank.page.ts:180 |
| Kérdésbank | Futásidejű UI-szöveg | Egy válaszlehetőség csak egyszer szerepelhet. | apps/web/src/app/settings/question-bank.page.ts:184 |
| Kérdésbank | Futásidejű UI-szöveg | Az alapkérdés módosításai mentve. | apps/web/src/app/settings/question-bank.page.ts:226 |
| Kérdésbank | Futásidejű UI-szöveg | Az alapkérdés létrejött. | apps/web/src/app/settings/question-bank.page.ts:226 |
| Specifikációs sablonok | Címke | Projekt neve | packages/contracts/src/markdown-templates.ts:21 |
| Specifikációs sablonok | Címke | Specifikációverzió metaadatai | packages/contracts/src/markdown-templates.ts:22 |
| Specifikációs sablonok | Címke | Projektkontextus | packages/contracts/src/markdown-templates.ts:23 |
| Specifikációs sablonok | Címke | Elfogadott projekt-kérdésséma | packages/contracts/src/markdown-templates.ts:24 |
| Specifikációs sablonok | Címke | Kezdő felmérés | packages/contracts/src/markdown-templates.ts:25 |
| Specifikációs sablonok | Címke | Felkészültség | packages/contracts/src/markdown-templates.ts:26 |
| Specifikációs sablonok | Címke | Döntési értékelés | packages/contracts/src/markdown-templates.ts:27 |

Összesen: **941** leltárelem.
