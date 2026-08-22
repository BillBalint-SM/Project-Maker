# Project Maker átadási és élesítési ellenőrzőlista

Ez az ellenőrzőlista a Project Maker átadásának két, egymástól független
kapuját választja szét:

1. az alkalmazás belső/VPN-környezetben történő élesítése;
2. az üzemeltető szervezet TLS SMTP/IMAP levelezési gateway-ének aktiválása.

Az első kapu teljesíthető a gateway aktiválása nélkül. Ilyenkor a projektmunka
használható, a levelezési műveletek pedig konfiguráció hiányában zártan
hibáznak. A projektügyfél-kommunikáció csak a második kapu után nevezhető
produkcióban aktiváltnak.

## Átadási csomag

Az átvevő, egyben üzemeltető szervezet a következő, egymásra hivatkozó
anyagokat kapja:

- a telepítendő, pontos Git commitot és annak zöld GitHub CI-eredményét;
- a [végfelhasználói útmutatót](user-guide.md);
- az [üzemeltetési átadást](operations-handoff.md), benne a migrációs,
  mentési és visszaállítási eljárással;
- az [Operator mail gateway runbookot](mail-gateway.md) és a
  `scripts/setup-mail-gateway.ps1` interaktív wizardot;
- ezt a döntési és aláírási ellenőrzőlistát.

Valódi `.env`, jelszó, CA-tartalom, postafiók-tartalom vagy
projektügyfél-adat nem része az átadási csomagnak.

## Felelősök és átadandó bizonyíték

| Felelős | Feladat | Megőrzött, nem titkos bizonyíték |
| --- | --- | --- |
| Repository gazda | A telepítendő commit és a zöld CI rögzítése | 40 karakteres commit és CI-link |
| Hálózati/biztonsági gazda | Belső/VPN-elérés, HTTPS/TLS és tűzfalszabály | Jóváhagyott belső URL és dátum |
| Deployment gazda | Runtime-konfiguráció és Compose-élesítés | Konfigurációellenőrzés, health eredmény |
| Adatbázis-gazda | Mentés, visszaállíthatóság és adatmegőrzés | Mentés ideje, restore-drill eredménye |
| Üzleti elfogadó | Szintetikus teljes Project-journey ellenőrzése | Elfogadás dátuma és eredménye |
| Gateway gazda | Dedikált postafiók, plus-addressing, TLS SMTP/IMAP végpontok és hálózati elérés | Belső változásjegy vagy jóváhagyás |
| Deployment secret gazda | SMTP/IMAP jelszavak és opcionális CA biztonságos injektálása | Secret helyének belső hivatkozása, érték nélkül |
| Gateway-smoke operátor | Kontrollált valós gateway-próba | Dátum, commit és eredmény a meglévő belső változásjegyben |

## 1. kapu — az alkalmazás élesítése

### Előfeltételek

- [ ] A telepítési gazda rögzítette a pontos forrás-commitot; az élesítés nem
  egy közben változó branchből történik.
- [ ] A commit `checkpoint`, `mail-gateway` és `container-smoke` CI-kapuja
  zöld.
- [ ] Az alkalmazás csak az üzemeltető szervezet belső hálózatán/VPN-jén vagy
  azzal egyenértékű tűzfal és reverse proxy mögött érhető el.
- [ ] A külső végpont HTTPS-t használ, a `CORS_ORIGIN` pedig pontosan ezt az
  origint tartalmazza. Az alkalmazás saját email/jelszó alapú, önkiszolgáló
  Internal-user bejelentkezést használ. Minden aktív Internal user azonos
  képességekkel rendelkezik; nincsenek szerepkörök vagy projektjogosultságok.
  A VPN továbbra is az elérési határ, ezért nyilvános internetes kitettség nem
  elfogadható.
- [ ] A `.env` az üzemeltető szervezet jóváhagyott runtime/secret helyén van,
  nem került Gitbe, ticketbe, chatbe vagy átadási dokumentumba.
- [ ] Meglévő adatbázis frissítése előtt készült ellenőrzött PostgreSQL-mentés.
  Új, üres telepítésnél ezt az operátor kifejezetten `nem alkalmazható`ként
  rögzítette.
- [ ] Az üzemeltető szervezet kijelölte a mentési megőrzés és a visszaállítási
  próba felelősét. A restore eljárás az üzemeltetési átadás szerint, nem az éles
  adatbázison lett kipróbálva.

### Telepítési kapuk

1. Futtasd a pontos forrás-checkoutban a három CI-kapunak megfelelő helyi
   ellenőrzéseket. A `migration:run` és a `pnpm verify` kizárólag erre kijelölt,
   nem produkciós teszt-adatbázist használhat; a másik két parancs saját
   eldobható környezetet hoz létre és takarít el:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm --filter @project-maker/api migration:run
   pnpm verify
   pnpm test:mail-gateway
   node scripts/run-container-smoke.mjs
   ```

2. Töltsd ki az üzemeltető szervezet környezetének `.env` fájlját, majd
   ellenőrizd a Compose konfigurációt anélkül, hogy annak tartalmát naplóznád:

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
   A `pending: false` és mind a 35 migráció megléte kötelező.
6. Szintetikus adatokkal járd végig legalább ezt az üzleti smoke-ot: projekt
   létrehozása és kilépés, visszatérés a Projektportfólióba, kérdésséma
   elfogadása, felmérési válasz mentése, felmérés lezárása, Becslési
   felkészültség megnyitása, tisztázandó tétel létrehozása, Projektállapot
   ellenőrzése és pontos visszatérés a kiinduló listába.
7. Ellenőrizd 390 képpont széles nézetben és billentyűzettel a globális és a
   Projekt-navigációt, az elsődleges feladatot, valamint a hiba utáni
   újrapróbálást.

### Az első kapu eredménye

Az alkalmazás akkor adható át üzleti használatra, ha minden fenti pont sikeres.
Ha a gateway-kapu még nincs kész, az átadási jegyzőkönyvben szerepeljen:
`Az alkalmazás éles; a projektügyfél-kommunikáció az üzemeltető szervezet
gateway-ének aktiválása után lesz produkcióban használható.`

## 2. kapu — levelezési gateway aktiválás

Ezt a kaput kizárólag az üzemeltető szervezet gateway-, deployment-secret- és
üzemeltetési felelősei hajthatják végre. A szállító nem kap postafiók-
hozzáférést, jelszót, CA-tartalmat vagy kitöltött `.env` fájlt.

- [ ] A gateway gazda létrehozta vagy kijelölte a dedikált correspondence
  mailboxot, és igazolta, hogy a plus-addressing ugyanabba az Inboxba érkezik.
- [ ] Az SMTP és IMAP végpont csak `STARTTLS_REQUIRED` vagy `IMPLICIT_TLS`
  módban érhető el, a tanúsítványlánc ellenőrzött, és TLS 1.2 vagy újabb
  szükséges.
- [ ] Az SMTP és IMAP külön hitelesítője a jóváhagyott secret store-ban van;
  nincs plaintext, opportunista downgrade vagy fallback mód.
- [ ] A `scripts/setup-mail-gateway.ps1` helyi konfigurációt készített a titkok
  megjelenítése nélkül, majd a `pnpm compose:config` sikeres.
- [ ] A konfigurált dedikált identity a tényleges SMTP envelope és `From`
  feladó; személyes vagy alternatív feladó nem engedélyezett.
- [ ] A [kontrollált gateway-smoke](mail-gateway.md#controlled-gateway-smoke)
  minden küldési, Reply-To, IMAP, deduplikációs, hiba- és TLS-ellenőrzése
  sikeres.
- [ ] A futtatás dátuma, a telepített forrás-commit és a sikeres eredmény az
  üzemeltető szervezet meglévő belső változásjegyében szerepel, titok vagy
  projektügyfél-adat nélkül.

## Go/No-Go döntés

### Go — alapalkalmazás

- minden első kapus ellenőrzés zöld;
- a hálózati/VPN és HTTPS határ bizonyított;
- meglévő adatnál van ellenőrzött mentés és visszaállítási felelős;
- a health, migráció és szintetikus Project-journey sikeres;
- a gateway státuszát pontosan, nem kész funkcióként kommunikálják, amíg a
  második kapu nincs lezárva.

### Go — levelezési gateway

- az alapalkalmazás Go állapotú;
- a plus-addressing, a külön hitelesítők és a TLS-korlátok bizonyítottak;
- a kontrollált gateway-smoke eredménye a telepített forrás-commithoz tartozik.

### No-Go

- nyilvános vagy nem kontrollált hálózati kitettség a VPN-határ megkerülésével;
- hiányzó mentés meglévő adat frissítése előtt;
- sikertelen health vagy függő/sikertelen migráció;
- valódi projektügyfél-adatokkal végzett első próba;
- aktiváltnak nevezett gateway dokumentált sikeres smoke nélkül;
- sikertelen plus-address, TLS-ellenőrzés gyengítése, vagy személyes/alternatív
  küldő engedélyezése.

## Visszaállítás és visszavonás

1. Állítsd le a web- és API-írásokat; a PostgreSQL volume-ot ne töröld.
2. Rögzítsd a hiba idejét és a telepített commitot titok vagy
   projektügyfél-adat nélkül.
3. Adatvesztési vagy migrációs probléma esetén az ellenőrzött mentésből, az
   [ellenőrzött restore eljárással](operations-handoff.md#controlled-restore)
   állíts vissza. Ne próbálj adatot törölni azért, hogy egy védett migration
   rollback lefusson.
4. Alkalmazásregressziónál az előre rögzített korábbi forrás/artifact és az
   ahhoz illeszkedő adatbázis-visszaállítási terv használható; mozgó branchből
   ne építs rollbacket.
5. Gateway-incidensnél állítsd le a levelezési funkció használatát, majd a
   titokkezelőben vond vissza vagy cseréld a szükséges SMTP/IMAP hitelesítőt.
   A megőrzött levelezési előzményt, ellenőrzőpontot és adatbázis-volumet ne
   töröld.
6. Újranyitás előtt ismételd meg a health-, migrációs és releváns
   gateway-smoke kapukat.

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
| Gateway státusz: `NINCS AKTIVÁLVA` / `AKTIVÁLVA` | |
| Gateway-smoke commit, dátum és eredmény | |
| Nyitott üzemeltetési korlátozás | |

Titkos vagy személyes érték nem írható ebbe a táblázatba.
