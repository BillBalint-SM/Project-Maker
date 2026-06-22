# Jövőbeli skálázás

## Architektúrai nézőpont

A jelenlegi desktop/Tauri MVP jó arra, hogy validáljuk a workflow-t, a checklist logikát és magát a termékötletet. Egy 20 000 felhasználós egyetemi környezethez viszont a javasolt célarchitektúra egy Angular web app / PWA, Microsoft Entra ID alapú bejelentkezéssel és központi backend API-val.

Javasolt cél stack:

- Frontend: Angular web app / PWA.
- Authentikáció: Microsoft Entra ID, az egyetemi M365 bejelentkezéssel.
- Backend API: Node/NestJS vagy Rust, amely validálja az Entra tokeneket, kezeli a jogosultságokat, az üzleti logikát, az exportokat és az adatbázis-hozzáférést.
- Adatbázis: első körben saját Azure Database for PostgreSQL.
- Fájlok és exportok: Azure Blob Storage.
- Naplózás és monitorozás: Application Insights és Azure Monitor.
- Jogosultságkezelés: Entra groupok, app roles, vagy saját alkalmazáson belüli RBAC modell.
- Deployment: Azure App Service vagy Azure Container Apps.
- Titkok és konfigurációk: Azure Key Vault.
- Frissítési modell: automatikus webes deployment CI/CD-n keresztül.

Első nagyobb verzióhoz a single-tenant Entra ID alkalmazás a legtisztább modell, ha az appot egy egyetem használja. Ha később több egyetem számára is elérhető SaaS termék lenne, akkor multi-tenant Entra appra és tenant-szintű adatelkülönítésre kell átállni.

A backendnek kell érvényesítenie a biztonsági szabályokat. A frontend önmagában nem lehet bizalmi pont: a backend validálja az Entra ID tokeneket, ellenőrzi a jogosultságokat, és ő kezeli az érzékeny üzleti műveleteket.

Az alkalmazás ne tároljon Microsoft jelszót vagy teljes M365 profilt. Csak a működéshez szükséges minimális azonosítókat érdemes menteni, például tenant ID-t, Entra object ID-t, és opcionálisan megjelenítési nevet vagy e-mail címet a felhasználói élmény miatt.

## Business nézőpont

Ez az irány a terméket egy lokális PM/PO segédeszközből skálázható egyetemi platformmá emeli. A legnagyobb üzleti érték, hogy a felhasználók a már meglévő egyetemi identitásukkal tudnak belépni, külön regisztráció, külön jelszó és telepítési nehézségek nélkül.

Fő üzleti előnyök:

- Nem kell külön felhasználói jelszóadatbázist üzemeltetni.
- Könnyebb egyetemi bevezetés, mert a login az intézményi M365 környezetre épül.
- Központi frissítés: minden user a legújabb verziót használja a webes deployment után.
- Jobb governance: Entra admin consent, csoportalapú jogosultság, naplózás és auditálhatóság.
- Hitelesebb enterprise/egyetemi működés, mint telepítőket küldözgetni sok felhasználónak.
- Jobb riportolhatóság tanszékek, karok, projektek vagy portfóliók szintjén.

Az első skálázható üzleti lépés egy kontrollált egyetemi pilot legyen. Például egy kisebb PM/PO/BA kör, egy belső IT csapat, egy kar, vagy egy oktatási/projektmenedzsment kurzus. Így kisebb kockázattal tesztelhető, hogy a workflow, a terminológia, a jogosultsági modell és a riportolási igények valóban illeszkednek-e az intézmény működéséhez.

Első körben az app saját Azure PostgreSQL adatbázist használjon. Az egyetem meglévő adatbázisához való közvetlen integráció későbbi lépés legyen, amikor már tiszta az adatgazda, a governance, az adatvédelmi felelősség, az integrációs szerződés és az üzemeltetési határ.

Tisztázandó business döntések skálázás előtt:

- Egyetlen egyetem az első cél, vagy több intézmény?
- Ki az adatok tulajdonosa: az egyetem, egy szervezeti egység, vagy a platform üzemeltetője?
- Mennyi ideig kell megőrizni a projektadatokat?
- Kell-e minden módosításról audit log?
- Mely user csoportok hozhatnak létre, szerkeszthetnek, hagyhatnak jóvá, archiválhatnak vagy exportálhatnak projekteket?
- Belső intézményi platform, licencelt SaaS termék, vagy white-label egyetemi megoldás a cél?

## User nézőpont

A skálázott verzió felhasználói élménye legyen nagyon egyszerű: a user megnyit egy URL-t, belép az egyetemi M365 fiókjával, és elkezdheti vagy folytathatja a munkát. Ne kelljen telepítenie semmit, ne kelljen frissítésekkel foglalkoznia, és ne kelljen értenie az alatta lévő infrastruktúrát.

Elvárt user journey:

- A user megnyitja az app URL-jét.
- Az app Microsoft loginra irányítja, ha még nincs bejelentkezve.
- Sikeres M365 authentikáció után a user belép a Project Maker workspace-be.
- A hozzáférést Entra group, app role vagy alkalmazáson belüli szerepkör határozza meg.
- Az app desktopon, laptopon, tableten és mobilon is használható reszponzív PWA-ként.
- A frissítések automatikusan megjelennek a következő használatkor.

A user csak azokat az adatokat és műveleteket lássa, amelyek a szerepköréhez tartoznak. Példák:

- Hallgató / alap user: számára kiosztott projektfelmérések kitöltése.
- PM / PO: projektek létrehozása, szerkesztése, követése, archiválása és exportálása.
- Reviewer / oktató / vezető: review, komment, jóváhagyás vagy pontosítás kérése.
- Admin: sablonok, státuszok, jogosultságok, exportok és riportok kezelése.

A terméknek meg kell őriznie az MVP egyszerűségét:

- Egyértelmű fő műveletek.
- Automatikus mentés.
- Ne legyen véletlen adatvesztés.
- Készültségi és kitöltöttségi visszajelzések.
- Könnyű export PDF-be és Excelbe.
- Mobilbarát űrlapok.
- Átlátható státusz- és follow-up kezelés.

A usernek nem kell tudnia, fizikailag hol tárolódnak az adatok. A számára fontos élmény az, hogy a munkája mentve van, a hozzáférés biztonságos, és mindig a legfrissebb verziót használja.
