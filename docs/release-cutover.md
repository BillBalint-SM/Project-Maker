# Project Maker átadási és élesítési ellenőrzőlista

Ez az ellenőrzőlista a Project Maker átadásának két, egymástól független
kapuját választja szét:

1. az alkalmazás belső/VPN-környezetben történő élesítése;
2. a Microsoft 365 ügyfélkommunikációs csatorna ügyféloldali aktiválása.

Az első kapu teljesíthető a Microsoft 365 tenant aktiválása nélkül. Ilyenkor a
projektmunka használható, a Microsoft 365 műveletek pedig konfiguráció hiányában
zártan hibáznak. A levelezési funkció csak a második kapu után nevezhető
produkcióban aktiváltnak.

## Átadási csomag

Az ügyfél a következő, egymásra hivatkozó anyagokat kapja:

- a telepítendő, pontos Git commitot és annak zöld GitHub CI-eredményét;
- a [végfelhasználói útmutatót](user-guide.md);
- az [üzemeltetési átadást](operations-handoff.md), benne a migrációs,
  mentési és visszaállítási eljárással;
- a [Microsoft 365 csatorna runbookját](microsoft-365-channel.md) és a
  `scripts/setup-m365-channel.ps1` interaktív wizardot;
- a redaktált tenant-smoke sablont
  (`docs/evidence/m365-tenant-smoke.json`) és annak fail-closed ellenőrzőjét;
- ezt a döntési és aláírási ellenőrzőlistát.

Valódi `.env`, jelszó, privát kulcs, hozzáférési token, postafiók-tartalom vagy
ügyféladat nem része az átadási csomagnak.

## Felelősök és átadandó bizonyíték

| Felelős | Feladat | Megőrzött, nem titkos bizonyíték |
| --- | --- | --- |
| Repository gazda | A telepítendő commit és a zöld CI rögzítése | 40 karakteres commit és CI-link |
| Hálózati/biztonsági gazda | Belső/VPN-elérés, HTTPS/TLS és tűzfalszabály | Jóváhagyott belső URL és dátum |
| Deployment gazda | Runtime-konfiguráció és Compose-élesítés | Konfigurációellenőrzés, health eredmény |
| Adatbázis-gazda | Mentés, visszaállíthatóság és adatmegőrzés | Mentés ideje, restore-drill eredménye |
| Üzleti elfogadó | Szintetikus teljes Project-journey ellenőrzése | Elfogadás dátuma és eredménye |
| Entra adminisztrátor | Single-tenant alkalmazás, publikus tanúsítvány, `Mail.Send` consent | Belső változásjegy vagy jóváhagyás |
| Exchange adminisztrátor | Dedikált postafiók, plus addressing, szűkített `Application Mail.Read` | In-scope/out-of-scope ellenőrzés eredménye |
| Deployment secret gazda | Privát kulcs és tenant-értékek biztonságos injektálása | Secret helyének belső hivatkozása, érték nélkül |
| Tenant-smoke operátor | Kontrollált valós M365 próba | Kizárólag a redaktált evidence JSON |

## 1. kapu — az alkalmazás élesítése

### Előfeltételek

- [ ] A telepítési gazda rögzítette a pontos forrás-commitot; az élesítés nem
  egy közben változó branchből történik.
- [ ] A commit `checkpoint` és `container-smoke` CI-kapuja zöld.
- [ ] Az alkalmazás csak az ügyfél belső hálózatán/VPN-jén vagy azzal
  egyenértékű tűzfal és reverse proxy mögött érhető el.
- [ ] A külső végpont HTTPS-t használ, a `CORS_ORIGIN` pedig pontosan ezt az
  origint tartalmazza. Az alkalmazásban nincs saját bejelentkezés vagy
  jogosultság-ellenőrzés, ezért nyilvános internetes kitettség nem elfogadható.
- [ ] A `.env` az ügyfél jóváhagyott runtime/secret helyén van, nem került
  Gitbe, ticketbe, chatbe vagy átadási dokumentumba.
- [ ] Meglévő adatbázis frissítése előtt készült ellenőrzött PostgreSQL-mentés.
  Új, üres telepítésnél ezt az operátor kifejezetten `nem alkalmazható`ként
  rögzítette.
- [ ] Az ügyfél kijelölte a mentési megőrzés és a visszaállítási próba
  felelősét. A restore eljárás az üzemeltetési átadás szerint, nem az éles
  adatbázison lett kipróbálva.

### Telepítési kapuk

1. Futtasd a pontos forrás-checkoutban a repository ellenőrzéseit:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm verify
   pnpm test:e2e
   ```

2. Töltsd ki az ügyfélkörnyezet `.env` fájlját, majd ellenőrizd a Compose
   konfigurációt anélkül, hogy annak tartalmát naplóznád:

   ```powershell
   pnpm compose:config
   ```

3. Meglévő adat frissítésekor készíts mentést az
   [üzemeltetési átadás PostgreSQL backup](operations-handoff.md#postgresql-backup)
   szakasza szerint. Ezután indítsd a stacket:

   ```powershell
   pnpm compose:up
   ```

4. Ellenőrizd a belső HTTPS URL-en a webalkalmazást és a proxyn át elérhető
   `/api/health` végpontot.
5. Ellenőrizd a migrációs állapotot az
   [üzemeltetési átadás dokumentált parancsával](operations-handoff.md#database-migrations-and-recovery).
   A `pending: false` és mind a 23 migráció megléte kötelező.
6. Szintetikus adatokkal járd végig legalább ezt az üzleti smoke-ot:
   projekt létrehozása és kilépés, visszatérés a Projektportfólióba, kérdésséma
   elfogadása, felmérési válasz mentése, felmérés lezárása, Becslési
   felkészültség megnyitása, tisztázandó tétel létrehozása, Projektállapot
   ellenőrzése és pontos visszatérés a kiinduló listába.
7. Ellenőrizd 390 képpont széles nézetben és billentyűzettel a globális és a
   Projekt-navigációt, az elsődleges feladatot, valamint a hiba utáni
   újrapróbálást.

### Az első kapu eredménye

Az alkalmazás akkor adható át üzleti használatra, ha minden fenti pont sikeres.
Ha az M365 kapu még nincs kész, az átadási jegyzőkönyvben szerepeljen:
`Az alkalmazás éles; a Microsoft 365 ügyfélkommunikáció tenant-ready, de még
nem produkcióban aktivált.`

## 2. kapu — Microsoft 365 aktiválás

Ezt a kaput kizárólag az ügyfél Entra-, Exchange-, deployment-secret- és
üzemeltetési felelősei hajthatják végre. A szállító nem kap tenant-adminisztrátori
hozzáférést, postafiók-hozzáférést, privát kulcsot vagy kitöltött `.env` fájlt.

- [ ] Az adminisztrátorok az ügyfélkörnyezetben futtatták a
  `scripts/setup-m365-channel.ps1` wizardot.
- [ ] Entra oldalon csak a publikus tanúsítvány került feltöltésre; a privát
  kulcs az ügyfél secret store-jában maradt.
- [ ] A tenant-wide `Mail.Send` consent dokumentáltan elfogadott.
- [ ] Az Exchange `Application Mail.Read` csak a dedikált Project Maker
  postafiókra érvényes; egy másik postafiók igazoltan kívül esik a scope-on, és
  nincs korlátlan Entra `Mail.Read` grant.
- [ ] A dedikált plus-címre küldött próba megérkezett. Sikertelenség esetén az
  aktiválás leállt; tárgy- vagy levéltörzs-alapú korreláció nem használható.
- [ ] A [kontrollált tenant-smoke](microsoft-365-channel.md#controlled-microsoft-365-tenant-smoke)
  minden pozitív, negatív, retry-, reply- és deduplikációs ellenőrzése sikeres.
- [ ] A redaktált evidence kizárólag a jóváhagyott mezőket tartalmazza, és a
  következő parancs zöld:

  ```powershell
  pnpm verify:m365-tenant-smoke
  ```

A végrehajtandó tenant-feladat és annak elfogadási kritériumai a
[GitHub #95](https://github.com/BillBalint-SM/Project-Maker/issues/95) issue-ban
maradnak nyitva a valós aktiválásig.

## Go/No-Go döntés

### Go — alapalkalmazás

- minden első kapus ellenőrzés zöld;
- a hálózati/VPN és HTTPS határ bizonyított;
- meglévő adatnál van ellenőrzött mentés és visszaállítási felelős;
- a health, migráció és szintetikus Project-journey sikeres;
- az M365 státuszát pontosan, nem kész funkcióként kommunikálják, amíg a
  második kapu nincs lezárva.

### Go — Microsoft 365 csatorna

- az alapalkalmazás Go állapotú;
- a #95 minden kritériuma teljesült;
- a redaktált tenant-smoke evidence a telepített forrás-commithoz tartozik és
  az ellenőrző elfogadja.

### No-Go

- nyilvános vagy nem kontrollált hálózati kitettség saját autentikáció nélkül;
- hiányzó mentés meglévő adat frissítése előtt;
- sikertelen health vagy függő/sikertelen migráció;
- valódi ügyféladatokkal végzett első próba;
- M365 aktiváltnak nevezett környezet `NOT_RUN` vagy sikertelen tenant-smoke
  evidence mellett;
- sikertelen plus-address vagy dedikált postafiókon kívülre is érvényes
  `Mail.Read` jogosultság.

## Visszaállítás és visszavonás

1. Állítsd le a web- és API-írásokat; a PostgreSQL volume-ot ne töröld.
2. Rögzítsd a hiba idejét és a telepített commitot titok vagy ügyféladat nélkül.
3. Adatvesztési vagy migrációs probléma esetén az ellenőrzött mentésből, az
   [ellenőrzött restore eljárással](operations-handoff.md#controlled-restore)
   állíts vissza. Ne próbálj adatot törölni azért, hogy egy védett migration
   rollback lefusson.
4. Alkalmazásregressziónál az előre rögzített korábbi forrás/artifact és az
   ahhoz illeszkedő adatbázis-visszaállítási terv használható; mozgó branchből
   ne építs rollbacket.
5. M365-incidensnél először vond vissza az Exchange role assignmentet és
   resource scope-ot, majd szükség szerint a Graph consentet vagy a publikus
   tanúsítványt; a Project Makerben megőrzött levelezési előzményt ne töröld.
6. Újranyitás előtt ismételd meg a health, migrációs és releváns smoke-kapukat.

## Átadási jegyzőkönyv

| Mező | Érték |
| --- | --- |
| Telepített commit | |
| CI futás | |
| Környezet és belső HTTPS URL | |
| Adatbázis-mentés / új telepítés jelölése | |
| Restore-drill eredménye | |
| Alkalmazás-smoke dátuma és eredménye | |
| Üzleti elfogadó | |
| M365 státusz: `NINCS AKTIVÁLVA` / `AKTIVÁLVA` | |
| M365 evidence commit és dátum | |
| Nyitott üzemeltetési korlátozás | |

Titkos vagy személyes érték nem írható ebbe a táblázatba.
