# Project Maker felhasználói kézikönyv

A Project Maker az igényfelmérés és -tisztázás közös munkafelülete. Ez a kézikönyv úgy vezeti végig a napi használaton, mintha most kapnád meg először az alkalmazást.

Megmutatja, mit érdemes rögzíteni, mit jelent az eredmény, mikor történik külső hatás, és hogyan folytathatod biztonságosan, ha valami megszakad.

**Tartalom**

- [Hogyan használd ezt az útmutatót?](#hogyan-használd-ezt-az-útmutatót)
- [Project Maker öt percben](#project-maker-öt-percben)
- [Mielőtt dolgozni kezdesz](#mielőtt-dolgozni-kezdesz)
- [A felület térképe](#a-felület-térképe)
- [A teljes napi workflow](#a-teljes-napi-workflow)
- [Első projekted: vezetett gyorsindítás](#első-projekted-vezetett-gyorsindítás)
- [Projektek áttekintése](#projektek-áttekintése)
- [Projektállapot és Projektbeállítások](#projektállapot-és-projektbeállítások)
- [A közös kérdésbank kezelése](#a-közös-kérdésbank-kezelése)
- [Projektséma és kezdő felmérés](#projektséma-és-kezdő-felmérés)
- [Felmérés lezárása és felmérési összefoglaló](#felmérés-lezárása-és-felmérési-összefoglaló)
- [Felkészültségi értékelés és hiányok](#felkészültségi-értékelés-és-hiányok)
- [Tisztázandó tételek kezelése](#tisztázandó-tételek-kezelése)
- [Ügyfél-emlékeztetők](#ügyfél-emlékeztetők)
- [Specifikációverziók és átadási pillanatképek](#specifikációverziók-és-átadási-pillanatképek)
- [Legutóbbi aktivitás és technikai audit](#legutóbbi-aktivitás-és-technikai-audit)
- [Archiválás, visszaállítás és végleges törlés](#archiválás-visszaállítás-és-végleges-törlés)
- [Hibahelyzetek és biztonságos folytatás](#hibahelyzetek-és-biztonságos-folytatás)
- [Fogalomtár és állapotreferencia](#fogalomtár-és-állapotreferencia)
- [Mit nem tud még a jelenlegi verzió?](#mit-nem-tud-még-a-jelenlegi-verzió)
- [Napi és átadási ellenőrzőlisták](#napi-és-átadási-ellenőrzőlisták)

## Hogyan használd ezt az útmutatót?

Ha még nem dolgoztál a Project Makerrel, olvasd végig a [vezetett gyorsindítást](#első-projekted-vezetett-gyorsindítás), majd haladj a részletes fejezetekkel a napi workflow sorrendjében. Ha már ismered az alapokat, a tartalomjegyzékből közvetlenül megnyithatod az adott műveletet vagy hibahelyzetet.

A leírás elsődleges olvasója PM, PO, BA vagy más projektmunkatárs. A [közös kérdésbank](#a-közös-kérdésbank-kezelése) fejezete annak a kijelölt szervezeti gazdának is szól, aki a minden projektre ható kérdéskészletet gondozza.

Az alkalmazás felülete szakmai angol nyelvű. Ez az útmutató magyar magyarázó prózát használ, a képernyőn megjelenő oldalak, mezők, gombok és állapotok pontos angol feliratát pedig kódformázással idézi. Mindig a művelet üzleti hatását is ellenőrizd, ne csak a gomb helyét.

Minden részletes workflow ugyanarra a hét kérdésre válaszol:

1. Mi a művelet üzleti célja?
2. Milyen állapotból szabad elkezdeni?
3. Pontosan mit kell megtenni?
4. Mi marad meg a rendszerben, vagy mi jut el külső címzetthez?
5. Miből látszik, hogy sikerült?
6. Mi akadályozhatja meg?
7. Mi a biztonságos következő lépés?

> **Fontos különbség:** a Project Maker igényfelmérő és -tisztázó eszköz. Nem általános projektmenedzsment-rendszer, nem feladatkezelő és nem erőforrás-tervező. A felkészültségi értékelés, a Decision Score és a becslési ajánlás döntéstámogatás; a külön `Formal decisions` részben viszont a felhasználó rögzíthet formális `Go`, `Conditional Go` vagy `No-Go` döntést. A rendszer nem hoz ilyen döntést automatikusan.

## Project Maker öt percben

A Project Makerben egy projekt nem egyszerűen egy név. Egy közös munkatér, amely összeköti:

- az ügyfél kapcsolattartóját;
- az aktuális felelőst, következő lépést és határidőt;
- a projektre kiválasztott kérdéssémát;
- a vezetett kezdő felmérés mentett válaszait és verziózott felmérési összefoglalóit;
- a nyitott és lezárt tisztázási kérdéseket;
- az ügyfél-emlékeztetők állapotát;
- a változatlan Markdown-pillanatképeket;
- a fontosabb események auditnyomát.

Az alkalmazás napi használatának lényege röviden:

| Helyzet | Mit tegyél? | Mi lesz az eredmény? |
| --- | --- | --- |
| Új igény érkezett | Hozz létre projektet a kapcsolattartóval | Létrejön egy `In preparation` projekt, és megnyílik a felmérés indítása |
| Elindul az igényfelmérés | Adj felelőst, következő lépést, határidőt, és válassz státuszt | A portfólióban mindenki ugyanazt az operatív állapotot látja |
| Megvan a workshop kérdésköre | Tedd közzé a projektsémát | Rögzül, mely kérdések tartoznak ehhez a projekthez |
| Elindul a felmérés | Indíts kezdő felmérési kört és rögzítsd a válaszokat | A kör saját kérdéspillanatképet kap |
| Befejeződik a felmérés | Zárd le akkor is, ha maradt hiány, majd küldd a felmérési összefoglalót most vagy később | Verziózott piszkozat készül; a hiányok a felkészültségben maradnak láthatók |
| Tisztázottságot kell ellenőrizni | Nyisd meg a projekt `Estimation Readiness` oldalát, és kövesd a hiányok műveleteit | Aktuális kitöltöttség, felkészültség, tényezők és rendezett hiányok látszanak |
| Új bizonytalanság merült fel | Hozz létre tisztázandó tételt felelőssel és dátummal | A tisztázandó pont számonkérhetően megmarad |
| Átadási pont vagy review következik | Generálj és ellenőrizz specifikációverziót | Letölthető, változatlan projektpillanatkép készül |
| Lezárult az aktív munka | Archiváld a projektet a `Project Settings` veszélyzónájában | A történet megmarad, az aktív módosítások leállnak |

Az alkalmazás nem kényszerít végig egy varázslón. A jó minőségű adat és a helyes sorrend a munkát végző csapat felelőssége.

## Mielőtt dolgozni kezdesz

### Működési és hozzáférési határ

> **Biztonsági határ:** az alkalmazást csak a szervezet által kontrollált belső hálózaton vagy VPN-határon belül használd. Minden dolgozó saját e-mail-címével és jelszavával regisztrál, majd ugyanazokat a belső képességeket kapja. Nincsenek szerepkörök, projektjogosultságok vagy külön adminfiókok.

A `Question Bank` menüpontot minden aktív belső felhasználó eléri. Egy mentés minden későbbi projektsémára ható új bankverziót hoz létre, ezért a csapat egyezzen meg arról, ki és mikor módosítja.

Az auditnapló a bejelentkezett belső felhasználóhoz köti a műveleteket. Ez nem helyettesíti a csapaton belüli egyeztetést: változtatás előtt ellenőrizd, hogy nem dolgozik-e valaki ugyanazon az adaton.

### Adatbiztonsági alapszabályok

- Csak az igényfelméréshez és -tisztázáshoz szükséges üzleti adatot rögzítsd.
- Ne írj jelszót, hozzáférési tokent, privát kulcsot vagy más titkot válaszba, tisztázandó tételbe, Markdownba vagy mezőbe.
- Ügyfélnek küldés előtt ellenőrizd a projekt létrehozásakor megadott kapcsolattartó e-mail-címét.
- A Claude Code-nak szánt Markdownot ne küldd ügyfélnek; ügyfélkommunikációhoz a felmérési összefoglalót vagy az előnézett ügyfél-emlékeztetőt használd.
- Hasznos történettel rendelkező projektet archiválj. A törlés csak tudatosan eldobott `DRAFT` projekt és belső munkaadatainak eltávolítására való; ügyfélkommunikáció vagy Git-átadás után nem használható.
- Archivált projektet előbb állíts vissza, és csak utána hozz létre új tartalmat, még akkor is, ha egy közvetlen oldal technikailag megnyitható.

### Mit jelent a képernyő állapota?

| Jelenség | Jelentés | Teendő |
| --- | --- | --- |
| Forgó betöltésjelző | A webapp még adatot kér | Várj; ne indíts párhuzamos műveletet |
| Zöld sikerüzenet | A művelet választ kapott és sikerült | Ellenőrizd a megváltozott állapotot is |
| Piros hibaüzenet | A kérés nem fejeződött be | Olvasd el, mi maradt meg, majd a hiba szerinti helyreállítást kövesd |
| Letiltott gomb | Előfeltétel hiányzik, mentés folyik, vagy az állapot nem engedi a műveletet | Fejezd be a folyamatban lévő műveletet, mentsd a módosított beállítást, vagy állítsd vissza a projektet |
| Az oldal saját, angol Reload vagy Retry művelete | A betöltés vagy mentés megismételhető | Stabil kapcsolat mellett indítsd újra ugyanazt a kérést |

## A felület térképe

A felső navigáció kilenc állandó kiindulópontot ad. A menüfeliratok pontosan ezek; az adott oldal főcíme ettől eltérhet:

- `Portfolio` — főcíme `Portfolio Overview`: az aktív projektek és minden projekt bejárata;
- `Roadmap`: üzleti célok, kezdeményezések és projektek csoportosítása;
- `Notifications`: felhasználói értesítések;
- `New project`: új Customer Project rögzítése;
- `Active project queue` — főcíme `Active Project Queue`: a következő projektfeladatok priorizált munkasora;
- `Discovery follow-ups` — főcíme `Discovery Follow-ups`: az összes aktív projekt nyitott tisztázandó tétele;
- `Specification templates`: a Markdown-kimenet szervezeti sablonjai;
- `Git connections`: a közös Git-kapcsolati konfigurációk;
- `Question Bank`: a szervezeti szintű közös kérdésbank.

![A Portfolio Overview asztali nézete a globális navigációval és egy mintaprojekttel](assets/user-guide/11-project-work-hub-desktop.png)

*Az asztali `Portfolio Overview` oldalon az ügyfélválaszok száma közvetlenül a szűrt munkasorba vezet. A képen kizárólag fiktív mintaadat szerepel.*

![A Discovery Follow-ups oldal asztali nézete](assets/user-guide/12-project-work-hub-narrow.png)

*A Project Maker támogatott felülete asztali/laptop nézet, legalább 1024 CSS-pixel szélességgel. A képen kizárólag fiktív mintaadat szerepel.*

Egy projekten belül a közös fejléc és a visszalépő link őrzi a munkafolyamatot: a visszalépés pontosan a `Portfolio Overview`, az `Active Project Queue` vagy a `Discovery Follow-ups` korábbi állapotába visz, a projektfülek pedig ugyanabban a projektben maradnak.

| Felület | Mire való? | Legfontosabb műveletek |
| --- | --- | --- |
| `Portfolio Overview` | Aktív projektek áttekintése | Új projekt, következő feladat megnyitása |
| `Project Status` | Napi munkaállapot és projektkoordináció | Következő lépés, felelős és határidő; ügyféllevelezés; legutóbbi aktivitás |
| `Estimation Readiness` | Felkészültségi értékelés és tisztázások | Hiányok javítása, tisztázandó tételek létrehozása és lezárása |
| `Project Settings` | Projektadminisztráció | Alapadatok, ügyfélkapcsolat, automatikus ügyfél-emlékeztető, adminisztratív projektfázis, archiválás és törlés |
| `Initial Intake` | Projektséma, kezdő felmérés és felmérési összefoglaló | Séma elfogadása és első kör indítása, válaszadás, felmérés lezárása, előnézet és küldés |
| `Project Specification` | Változatlan kanonikus specifikációk | Specifikációverzió generálása, összehasonlítás, előnézet, Markdown letöltése |
| `Question Bank` | Minden projekt közös kérdéskészlete | Kérdés létrehozása, új verziót létrehozó szerkesztés |

Ha egy projekt vagy specifikációverzió közvetlen linkje már nem létező elemre mutat, térj vissza a projektlistára, és nyisd meg újra a kívánt elemet a felületről. Ne próbáld kézzel javítani az oldal címét.

## A teljes napi workflow

Az alábbi ábra a javasolt üzleti sorrendet mutatja. Nem rendszer által kikényszerített varázsló: a projekt státuszát és a lépések időzítését a csapat kézzel kezeli.

```mermaid
flowchart LR
    A[Projekt létrehozása] --> B[Projektállapot és felelős kijelölése]
    B --> C[Projektséma közzététele]
    C --> D[Kezdő felmérés]
    D --> E[Felmérés lezárása]
    E --> F{Felmérési összefoglaló küldése most?}
    F -- Igen --> G[Előnézet és küldés]
    F -- Később --> H[Piszkozat mentése]
    G --> I[Becslési felkészültség és hiányok áttekintése]
    H --> I
    I --> J[Tisztázandó tételek lezárása]
    J --> K[Specifikációverzió ellenőrzése]
    K --> L[Claude Code vagy belső átadás]
    L --> M{Folytatódik az aktív munka?}
    M -- Igen --> B
    M -- Nem --> N[Archiválás]
```

### 1. Indítás és közös kontextus

Hozd létre a projektet a megnevezett belső projektgazdával. A `Project Status` oldalon jelöld, hogy a következő feladat az `Internal project owner` vagy a `Customer contact` oldalán van, mi az egyetlen konkrét következő lépés, és mikorra esedékes. Az `Administrative project phase` mezőt a `Project Settings` oldalon tartsd összhangban a valós üzleti helyzettel; ez nem a számított felkészültségi állapot.

### 2. Kérdéskör rögzítése

Válaszd ki az aktív alapkérdések közül az adott projekthez szükségeseket, és tedd közzé a projektsémát. Ettől kezdve a csapat vissza tudja vezetni, melyik bankverzióból és mely kérdésekből indult a felmérés.

### 3. Felmérés és megszakításbiztos mentés

Indíts kezdő felmérési kört. Szöveges válasz után várd meg a `Saved` állapotot; választó, jelölő, szám- és dátumválasz azonnal ment. Megszakítás után ugyanaz a nyitott kör töltődik vissza. A felmérés végén a kört a tartalmi teljességtől függetlenül lezárhatod, majd előnézetből azonnal elküldheted a felmérési összefoglalót, vagy piszkozatként későbbre hagyhatod.

### 4. Becslési felkészültség és nyitott tisztázandó tételek

A felmérés értékelése után nyisd meg a projekt `Estimation Readiness` oldalát. A felmérés közben felmerülő, később megválaszolandó pontokat ne rejtsd el egy hosszú válaszban. Hozz létre külön tisztázandó tételt kategóriával, felelőssel, valódi céldátummal és következő lépéssel. Lezáráskor a döntést vagy választ is rögzítsd.

### 5. Pillanatkép és kommunikáció

Belső munkához generálhatsz friss specifikációverziót, abból fejlesztési csomagot készíthetsz, majd letöltheted vagy pontos előnézet után Gitbe adhatod. Saját Claude Code előfizetésedet a `Account settings` oldalon kapcsolhatod a Project Makerhez, így a specifikációt és a fejlesztési csomagot másolgatás nélkül kezelheted. A `.md` fájl és az MCP-kapcsolat nem ügyfélkommunikáció: ügyfélnek a felmérési összefoglalót vagy a külön megírt ügyfél-emlékeztetőt küldd.

### 6. Megőrzés

Ha az aktív munka véget ér, archiválj. A projekt a listában és az auditban megmarad. Törölni csak valóban üres, `In preparation` állapotú projektet szabad és lehet.

## Első projekted: vezetett gyorsindítás

Ez a gyorsindítás egy teljes, biztonságos első kört mutat. A részletes szabályokat a hivatkozott fejezetekben találod.

### Előfeltétel

- A webapp a szervezet belső hálózatán elérhető.
- Ismered az ügyfél kapcsolattartójának helyes nevét és e-mail-címét.
- Tudod, ki a belső operatív felelős.
- A `Question Bank` oldalon van legalább egy aktív kérdés.

### Lépések

1. Nyisd meg a `Portfolio Overview` oldalt, és válaszd a `New Project` gombot.
2. Add meg a projekt nevét, a kapcsolattartó nevét és e-mail-címét.
3. Válaszd a projekt létrehozását és a felmérés megnyitását.
4. A `Project Settings` oldalon állítsd az adminisztratív projektfázist `Discovery in progress` értékre.
5. A `Project Status` oldalon válaszd ki a következő feladat gazdáját (`Internal project owner` vagy `Customer contact`), add meg a következő lépést és szükség szerint a határidőt, majd válaszd a `Save coordination` gombot.
6. Nyisd meg a `Initial Intake` oldalt.
7. Ellenőrizd a kijelölt kérdéseket, majd válaszd a `Accept question schema and start Initial Intake` gombot. Ez egy műveletként menti a kérdéssémát és indítja el az első felmérési kört.
8. Ha a séma mentése sikerült, de a felmérés nem indult el, válaszd a `Retry starting Initial Intake` gombot; a sémát ne hozd létre újra.
9. Rögzítsd a válaszokat. Szöveges mezőknél várd meg a `Saved` visszajelzést.
10. A felmérés végén válaszd a `Complete intake and review gaps` vagy a `Complete and preview interview summary` műveletet. A lezáráshoz nem kell minden üzleti hiányt kitölteni, de függőben lévő vagy hibás mentés nem maradhat.
11. Küldés előtt olvasd át a felmérési összefoglaló előnézetét és ellenőrizd a címzettet. A sikeres küldés változatlan verziót hoz létre.
12. Ügyfél-módosítás esetén indíts új verziót, írd le a módosítás összefoglalását, szerkeszd a válaszokat, majd készíts új előnézetet és küldd el.
13. Nyisd meg a `Estimation Readiness` oldalt. Minden későbbi tisztázandó pontból hozz létre külön tisztázandó tételt.
14. Átadás előtt nyisd meg a `Project Specification` oldalt, és válaszd a `Generate specification version` gombot.
15. Ellenőrizd a `Content preview` részt és a specifikációverzió metaadatait.
16. Amikor már nincs aktív munka, nyisd meg a `Project Settings` oldalt, és archiváld a projektet a veszélyzónában.

### A gyorsindítás akkor kész, ha

- a projektkártyán látszik a felelős és a következő lépés;
- a projektséma verziószáma megjelenik;
- nincs nyitott, mentési hibás válasz;
- a kezdő felmérési kör lezárult;
- minden még nyitott bizonytalanságnak van felelőse és határideje;
- a legfrissebb specifikációverzió tartalmát valaki elolvasta;
- a `Project Status` oldalon a legutóbbi munkához szükséges aktivitások érthetően megjelentek.

## Projektek áttekintése

![A Project Maker projektlistája egy aktív mintaprojekttel és az új projekt indítási lehetőségével](assets/user-guide/01-projects.png)

*A projektlista a napi munka kiindulópontja; a státusz, a felelős és a következő lépés már a kártyán látható.*

### A projektlista értelmezése

A `Portfolio Overview` oldalon minden projekt egy kártya. A kártya megmutatja:

- a projekt nevét;
- az aktuális adminisztratív projektfázist;
- a következő feladat konkrét gazdáját, vagy a `Not assigned` jelzést;
- a `Next action` értékét, vagy a `Not specified` jelzést;
- a projekt aktuális elsődleges feladatához vezető belépési pontot.

A lista a projekt saját koordinációs vagy adminisztratív projektfázis-mentésének legutóbbi ideje szerint rendezi előre a kártyákat. Egy felmérési válasz vagy tisztázandó tétel önmagában nem feltétlenül mozgatja előre a projektet.

Azonos módosítási idő esetén a sorrend stabil marad. Az archivált projekt nem tűnik el: `Archived` állapottal ugyanebben a listában marad, hogy a történet később is megtalálható legyen.

### Betöltés, üres lista és hiba

- `Loading projects…`: várd meg a betöltést.
- `No results`: még nincs a szűrőnek megfelelő rögzített projekt. A `Create a new project` gomb ugyanazt az űrlapot nyitja meg, mint a `New project` navigációs pont.
- `Projects could not be loaded`: a lista nem érhető el. A `Reload project list` megismétli a betöltést.

Betöltési hiba nem töröl projektet és nem hoz létre újat. Ha a `Reload project list` ismét hibázik, ne töltsd ki újra több böngészőlapon ugyanazt a projektet; jelezd az üzemeltetőnek, hogy a webapp vagy a háttérszolgáltatás nem elérhető.

### Aktív munkasor

![Az Active Project Queue nézete három, sürgősség szerint rendezett fiktív projekttel, szűrőkkel és elsődleges műveletekkel](assets/user-guide/10-active-project-queue.png)

*Az Active Project Queue nézete a teljes portfólió következő teendőit csoportosítja; minden sor egy projektet és annak egyetlen elsődleges következő műveletét mutatja.*

A Portfolio Overview fejlécében válaszd az `Active Project Queue` gombot, ha nem egy előre kiválasztott projektből, hanem az összes aktív projekt közül szeretnéd eldönteni, mivel foglalkozz következőként. A csoportok mindig ebben a sürgősségi sorrendben jelennek meg:

1. új ügyfélválasz érkezett;
2. lejárt a következő lépés;
3. hamarosan lejár;
4. folyamatban van, de nincs közeli határidő.

A projektnév-keresés, a sürgősségi és a felkészültségi jelölők együtt szűkítik a listát. A szűrés és a rendezés a szerveren történik, ezért a csoportok és a darabszámok nem csak a már letöltött tíz sort írják le. A képernyő külön jelzi, hány projekt látható az aktuális oldalon, és hány felel meg összesen. A `Previous` és `Next` gombokkal tízesével járhatod be az eredményt.

Minden sorban ellenőrizd a projekt nevét, a felkészültségi állapotot, a következő lépést, a felelőst és a határidőt. A sor végén lévő elsődleges művelet a projekt jelenlegi következő munkafelületét nyitja meg. A böngésző Vissza művelete visszaadja ugyanazt a keresést, szűrést és lapozott oldalt.

Az oldal nem rendeződik át automatikusan a háttérben. Ha tudatosan friss képet szeretnél, használd az oldal aktuális frissítési műveletét. A frissítés az első oldalra áll, megtartja a szűrőket, kiírja az utolsó lekérés idejét, és képernyőolvasó számára is jelzi a sikert vagy a hibát.

Hiba esetén a biztonságos folytatás attól függ, volt-e már sikeresen betöltött oldal:

- kezdeti betöltési hibánál a lista helyett az `Retry` jelenik meg;
- frissítési vagy lapozási hibánál az utolsó sikeres oldal látható marad stale-data jelzéssel; az oldal saját újrapróbálási művelete pontosan ugyanazt a lapot és szűrést kéri újra;
- lejárt vagy érvénytelen oldalhivatkozásnál a rendszer biztonságosan az első oldalra áll, és ezt külön üzenetben jelzi;
- ha a szűrők mellett nincs találat, a `Clear filters` visszaállítja a teljes munkasort; ha egyáltalán nincs aktív projekt, innen visszatérhetsz a Portfolio Overviewhoz vagy új projektet hozhatsz létre.

A kereső, a jelölők, a frissítés, a lapozás és a sorműveletek billentyűzettel is használhatók a támogatott, legalább 1024 CSS-pixel széles asztali/laptop nézetben.

### Új projekt létrehozása

**Mikor használd?** Amikor új, önálló igényfelmérési vagy -tisztázási munkatérre van szükség. Ne hozz létre második projektet pusztán azért, mert a meglévő projekt éppen várakozik vagy archivált; előbb ellenőrizd, hogy azt kell-e visszaállítani.

1. Válaszd az `New Project` gombot.
2. Töltsd ki a `Project name` mezőt. Legyen egyértelmű, legfeljebb 255 karakteres név.
3. Töltsd ki a `Customer contact` mezőt a tényleges kapcsolattartó nevével; a mező legfeljebb 255 karaktert fogad el.
4. Töltsd ki a `Customer contact email` mezőt érvényes, legfeljebb 320 karakteres e-mail-címmel.
5. Ellenőrizd még egyszer a címet. Később a `Project Settings` oldalon a projekt neve, a belső projektgazda és az ügyfélkapcsolattartó neve vagy e-mail-címe is javítható.
6. Válaszd a létrehozást és a felmérés megnyitását.

Siker esetén a webapp létrehoz egy `In preparation` adminisztratív projektfázisú projektet, és közvetlenül a következő szükséges feladatra vezet. A projekt már a Portfolio Overviewban is látható.

Ha meggondoltad magad, a `Cancel` bezárja az űrlapot és nem hoz létre projektet. Ha az űrlap mezőhibát jelez, javítsd a kiemelt értéket; a projekt csak sikeres szerverválasz után jön létre.

> **Kapcsolattartói adat javítása:** nyisd meg a `Project Settings` oldalt, javítsd az adatot, és várd meg a sikeres mentést, mielőtt új ügyfélküldést indítasz. A módosítás a jövőbeli küldések címzettjét frissíti; a korábbi levelezési pillanatképeket nem írja át.

## Projektállapot és Projektbeállítások

A projekt közös fejlécében ugyanaz a szerver által számított munkaállapot, elsődleges feladat és visszatérési út látszik minden projektoldalon. A régi, mindent egy helyre zsúfoló projektoldal helyett két világos felelősségű felületet használj.

### Projektállapot: a napi munkaközpont

A `Project Status` oldal a projekt nevét és aktuális munkaállapotát, az egyetlen elsődleges feladatot, a projektkoordinációt, az ügyféllevelezés állapotát és az utolsó öt munkához szükséges aktivitást mutatja.

A koordinációban gyorsan szerkeszthető:

- a következő lépés felelőse: a megnevezett belső projektgazda vagy az ügyfélkapcsolattartó;
- az egyetlen konkrét következő lépés;
- a következő lépés határideje.

A `Save coordination` csak ezt a három napi munkamezőt módosítja. Nem változtat projektnevet, kapcsolattartót, adminisztratív projektfázist, archiválást vagy automatikus ügyfél-emlékeztető beállítást. Sikeres mentés után a közös projektfejléc is a friss, szerver által számított állapotot mutatja.

Az `Customer Correspondence` kártya megmutatja az új válaszok számát és a szükséges teendőt, majd a `Customer correspondence` oldalra vezet. A `Recent Activity` legfeljebb öt, emberi nyelven összefoglalt üzleti eseményt mutat. Nyers eseménykód, technikai adattartalom, ügyfélszöveg vagy titok nem jelenik meg az alkalmazotti felületen.

### Projektbeállítások: adminisztráció

A `Project Settings` oldal kezeli:

- a projekt nevét, a belső projektgazda nevét és az ügyfélkapcsolattartó adatait;
- az automatikus ügyfél-emlékeztető engedélyezését, időközét és végdátumát;
- az adminisztratív projektfázist;
- az archiválást, visszaállítást és a jogosult korai piszkozat végleges törlését.

Az alapadatok és az ügyfélkapcsolattartó aktív projektben a kérdésséma elfogadása után is szerkeszthetők. Archivált projektben csak olvashatók; módosításhoz előbb állítsd vissza a projektet. A mentés a jövőbeli munkához használt aktuális adatokat frissíti, a korábbi ügyfélkommunikáció és Git-átadás változatlan pillanatkép marad. Az automatikus ütemezés beállítása itt történik; a kézi ügyfél-emlékeztető megírása, előnézete, küldése és helyreállítása a `Customer correspondence` munkafelület feladata.

### Adminisztratív projektfázis

Ez egy kézzel rögzített üzleti fázis, nem a szerver által számított felkészültségi állapot, és nem teljes szállítási életciklus.

| Állapot | Mikor használd? | Mit nem jelent? |
| --- | --- | --- |
| `In preparation` | A projekt még formálódik | Nem jelenti automatikusan, hogy törölhető |
| `Discovery in progress` | Aktív igényfelmérés vagy workshop folyik | Nem jelenti, hogy minden kérdésnek van válasza |
| `Awaiting internal alignment` | A következő érdemi lépés belső információra vagy döntésre vár | Nem automatikus; a csapat tartja naprakészen |
| `Awaiting Customer feedback` | A következő érdemi lépés ügyfélválaszra vár | Önmagában nem küld levelet |
| `Handed over for planning` | A csapat üzletileg tervezésre átadottnak jelöli | Nem formális jóváhagyás és nem felkészültségi tanúsítvány |
| `Archived` | Az aktív követés lezárt vagy szünetel, a történet megmarad | Nem törlés; visszaállítható |

A `Handed over for planning` fázis beállítása továbbra is automatikusan létrehozza a meglévő `Milestone reached` okú specifikációverziót. A verzió változatlan marad; téves fázisválasztást újabb helyes fázissal és szükség esetén új specifikációverzióval korrigálj.

### Archivált projekt

Archiválás és törlés kizárólag a `Project Settings` elkülönített `Archive and Delete` részében érhető el, és explicit megerősítést kér. Archiválás után a projektoldalak és beállítások olvashatók maradnak, a módosítások és új külső műveletek szünetelnek. A `Restore project` az archiválás előtti adminisztratív fázist és teljes mentett munkafolyamat-állapotot folytatja; korábbi eseményt vagy küldést nem ismétel meg.

## A közös kérdésbank kezelése

![A közös alapkérdésbank első kérdései, a publikált bankverzió és az új kérdés létrehozási lehetősége](assets/user-guide/03-question-bank.png)

*A bankverzió azt jelzi, melyik változatból készülhetnek új projektsémák; egy korábbi projektpillanatképet a későbbi szerkesztés nem ír át.*

### Ki kezelje?

> **Szervezeti felelősség:** a `Question Bank` oldal technikailag minden alkalmazás-hozzáféréssel rendelkező személy számára elérhető. Mégis csak a kijelölt kérdésbank-gazda módosítsa, mert minden sikeres létrehozás vagy szerkesztés új, közös bankverziót publikál.

A kérdésbank célja, hogy a csapat ugyanazzal az igényfelmérési szókészlettel és ellenőrzési logikával dolgozzon. Nem egy projekthez tartozik. Ha csak egyetlen projektben szeretnél kihagyni egy kérdést, ne inaktiváld globálisan; a projekt kérdéssémájában vedd ki a kijelölést.

### A lista olvasása

Az oldal tetején a published version és a kérdések száma látható. Minden kártyán szerepel:

- a változatlan question key;
- a kérdés szövege és témája;
- a control point, vagyis milyen tisztázottságot ellenőriz;
- a sorrend;
- a kérdéstípus;
- az aktív állapot;
- a required állapot;
- a válaszadást segítő response guidance, ha van.

Az `Edit base question` nem a régi sort írja felül. A módosított kérdéssel és a többi kérdés átvitt állapotával új, változatlan bankverzió készül.

Ha a bank üres, a `No base questions yet` állapot és a `Create base question` gomb jelenik meg; ez ugyanazt a létrehozó űrlapot nyitja meg. Egy kérdéskártyán látható `Archived` címke ezen az oldalon inaktív alapkérdést jelent, nem archivált projektet.

### Új alapkérdés létrehozása

**Mikor használd?** Ha a kérdés több projektben is értelmes, szervezetileg elfogadott, és megfogalmazása elég stabil ahhoz, hogy későbbi projektsémák alapja legyen.

1. Válaszd a `New base question` gombot.
2. Adj `Question key` értéket. Legfeljebb 100 karakter lehet, csak kisbetűt, számot és kötőjelet tartalmazhat, például `customer-data-owner`.
3. Add meg a `Topic` értékét legfeljebb 255 karakterben.
4. A `Control point` mezőben fogalmazd meg, milyen állapotot vagy döntést igazol a válasz.
5. Válaszd ki a `Response type` értékét.
6. Írd be a `Question text` tartalmát úgy, ahogyan a workshopon feltennéd.
7. Add meg a `Display order` egész számot. Új kérdésnél csak a jelenlegi lista érvényes pozíciója vagy annak vége használható.
8. Szükség esetén adj `Response guidance (optional)` szöveget. Ez segítség, nem helyettesíti a kérdést.
9. Választós típusnál írd be a `Response options` értékeit, soronként egyet.
10. Állítsd be a négy viselkedési jelölőt.
11. Válaszd a `Create base question` gombot.

Siker esetén a bank verziószáma eggyel nő, a kérdés megjelenik a beállított pozíción, és az utána következő kérdések sorrendje eltolódik. A sikerüzenet és az új published version együtt igazolja a publikálást.

A `Cancel` elveti a megnyitott űrlap helyi tartalmát, és nem hoz létre új verziót.

### Meglévő kérdés szerkesztése

1. A megfelelő kártyán válaszd az `Edit base question` gombot.
2. Ellenőrizd, hogy valóban a legfrissebb bankverzió kérdését nyitottad meg.
3. Módosítsd a témát, ellenőrzési pontot, szöveget, típust, sorrendet, hintet, opciókat vagy jelölőket.
4. A `Question key` nem szerkeszthető. Ez biztosítja, hogy a kérdés azonosítható maradjon a verziók között.
5. Válaszd a `Save changes` gombot.

Ha más közben új bankverziót publikált, a régi kártyáról indított mentés ütközhet. Töltsd újra az oldalt, olvasd el a legfrissebb kérdést, és csak azután ismételd meg a szándékos módosítást.

Kérdés törlése nincs. Ha egy kérdést a jövőben nem szabad új projektsémába választani, kapcsold ki az `Active` jelölőt. Ez a későbbi kiválasztásból kiveszi, de a korábbi projektsémák és felmérések történetét nem módosítja.

### A hét kérdéstípus

| Típus | Mire való? | Válasz a felmérésben |
| --- | --- | --- |
| `Short text` | Rövid, tömör szöveges tény | Egysoros szöveg |
| `Long text` | Magyarázat, üzleti cél, folyamat vagy döntési háttér | Többsoros szöveg |
| `Single select` | Pontosan egy előre meghatározott lehetőség | Egy elem a listából |
| `Multi select` | Több, egymással együtt is igaz lehetőség | Egy vagy több jelölőnégyzet |
| `Yes or no` | Igen/nem állítás | Bejelölt állapot: igen; kikapcsolt, már mentett állapot: nem |
| `Number` | Véges numerikus érték | Számmező |
| `Date` | Naptári nap | `YYYY-MM-DD` dátum |

`Single select` és `Multi select` esetén legalább egy nem üres opciónak kell lennie. Soronként egy opciót írj; az üres sorokat a rendszer figyelmen kívül hagyja, az azonos opciókat viszont elutasítja. Más kérdéstípushoz nem tartozhat opciólista.

Típusváltáskor mindig ellenőrizd, hogy a kérdés jelentése és a korábbi válaszolási elvárás összhangban marad-e. A változtatás csak későbbi sémákra és körökre hat; a már elindított kör megőrzi a régi típust és opciókat.

### A négy viselkedési jelölő

| Jelölő | Jelenlegi tényleges hatás |
| --- | --- |
| `Required` | A felkészültségben és a későbbi tisztázásban hiányként látszik; a felmérés lezárását önmagában nem akadályozza |
| `Required for estimation` | Metaadatként megmarad; önmagában nem módosítja a kör lezárását vagy a projektállapotot |
| `Missing response blocks progress` | A nyitott körben kiemelt tisztázási útmutatást mutat; önmagában nem akadályozza a lezárást |
| `Active` | Bekapcsolva megjelenik az új projektséma-választásban; kikapcsolva új sémába nem választható |

A `Required` és `Missing response blocks progress` jelölő sem tartalmi lezárási kapu: kész, részben kész, nem releváns vagy hiányos eredménnyel is lezárható a felmérés. Csak függőben lévő vagy hibás technikai mentés blokkolja a lezáró gombokat. A `Required for estimation` nem külön pontszámkapu, és nem helyettesít döntési pontszámot, ajánlott döntést vagy automatikus projektállapot-váltást. A felkészültségi értékeléshez a [forráskörnek](#ha-az-értékelés-nem-elérhető-vagy-nem-töltődik-be) a jelenlegi kanonikus sémának kell megfelelnie.

### Tipikus mentési hibák és helyreállítás

| Helyzet | Biztonságos folytatás |
| --- | --- |
| A kérdésazonosító formátuma hibás vagy már létezik | Válassz egyedi, kisbetűs-kötőjeles azonosítót; meglévő fogalomnál inkább a régi kérdést szerkeszd |
| A sorrend kívül esik a listán | Adj 1 és az engedett utolsó pozíció közötti egész számot |
| Választós kérdésnek nincs opciója | Adj legalább egy nem üres sort |
| Két opció azonos | Egyesítsd vagy nevezd át őket úgy, hogy üzletileg is különbözzenek |
| A bank nem töltődik be | Válaszd a `Reload Question Bank` gombot; ne hozz létre párhuzamos másolatot másik lapon |
| Mentés közben új bankverzió született | Töltsd újra az oldalt, hasonlítsd össze a friss állapotot, majd ismételd meg a szükséges módosítást |

## Projektséma és kezdő felmérés

A projektséma azt rögzíti, hogy a közös kérdésbank aktuális kérdései közül melyek tartoznak az adott projekthez. A kezdő felmérési kör pedig erről a sémáról készít saját, változatlan pillanatképet.

```mermaid
flowchart LR
    A[Közös kérdésbank-verzió] --> B[Projekt kérdésséma-verzió]
    B --> C[Kezdő felmérés változatlan pillanatképe]
    C --> D[Mentett válaszok]
    B --> E[Markdown forráspillanatkép]
    C --> E
    D --> E
    E --> F[Letölthető specifikációverzió]
```

Egy későbbi kérdésbank-szerkesztés nem írja át a már közzétett projektsémát vagy a megkezdett felmérési kört. A Markdown a létrehozás pillanatában elérhető projekt-, séma-, kör- és válaszadatot másolja saját forráspillanatképébe.

A tisztázandó tételek és az ügyfél-emlékeztető beállításai jelenleg nem részei ennek a Markdown-forrásnak.

![Egy közzétett projektséma és a hozzá tartozó, részben megválaszolt nyitott kezdő felmérési kör](assets/user-guide/04-guided-interview.png)

*Bal oldalon a projekthez kiválasztott kérdések, jobb oldalon a változatlan körpillanatkép és a szerveren mentett válaszok láthatók.*

### Projektséma elfogadása és az első felmérés indítása

**Előfeltétel:** van legalább egy aktív alapkérdés, és nincs nyitott kezdő felmérési kör.

Első megnyitáskor a felület minden aktuálisan aktív alapkérdést kijelöl. Ez kiindulási ajánlás, nem kötelező teljes lista.

1. A projekt közös navigációjában nyisd meg a `Initial Intake` oldalt.
2. Olvasd el a `Select active base questions` listát.
3. Hagyd kijelölve az adott projekthez szükséges kérdéseket, a nem relevánsakat vedd ki.
4. Legalább egy kérdésnek kijelölve kell maradnia.
5. Első alkalommal válaszd a `Accept question schema and start Initial Intake` gombot.
6. Várd meg az `Accepted question schema v… (bank v…)` visszajelzést és a folyamatban lévő felmérés kérdéskártyáit.

A séma saját verziószáma azt mutatja, hányadik közzétett projektsémát látod. A bankverzió azt jelzi, melyik közös kérdésbankból készült. A két számnak nem kell azonosnak lennie.

Az első elfogadás előtt nincs külön kezdőfelmérés-kártya vagy kézi körindító gomb. Az elfogadás változatlan projektsémát ment, majd pontosan egy kezdő felmérési kört indít. Ha a séma már megmaradt, de a kör indítása megszakadt, a felület csak a `Retry starting Initial Intake` műveletet kínálja; frissítés után is innen folytathatsz.

Ha nincs aktív alapkérdés, a felület `No active base questions` állapotot mutat. A projektindítási piszkozat megmarad és később folytatható. Kérd meg a kijelölt kérdésbank-gazdát, hogy legalább egy megfelelő kérdést aktiváljon, majd töltsd újra az oldalt.

### Projektséma frissítése

**Mikor használd?** Ha a következő felmérési kör kérdésköre változik, és nincs nyitott kör.

1. Módosítsd a kijelöléseket.
2. Válaszd az `Update question schema` gombot.
3. Ellenőrizd, hogy a sémaverzió eggyel nőtt.

A frissítés utódsémát hoz létre. Egy korábbi nyitott vagy lezárt kör kérdései nem változnak. Az új séma csak a később indított körre hat.

Nyitott kör alatt a jelölőnégyzetek és a publikálási gomb le vannak tiltva. Előbb fejezd be a mentéseket és zárd le a kört; a kör közben ne próbáld a kérdéslistát megváltoztatni.

### Kezdő felmérési kör folytatása

A jelenlegi felület egyetlen körtípust szállít: a kezdő felmérést. További körtípus jelenleg nincs.

Az első kezdő felmérési kört a kérdésséma elfogadása automatikusan elindítja.

1. Várd meg a `Initial Intake in progress` állapotot és a kérdéskártyákat.
2. Haladj a kérdéseken a workshop természetes sorrendjében.

Az indítás a projektséma teljes, változatlan pillanatképét másolja a körbe: kérdésszöveg, téma, ellenőrzési pont, típus, opciók, `Required`, `Missing response blocks progress` és `Response guidance (optional)`. Ezért egy későbbi bank- vagy sémamódosítás a futó körön nem látszik.

Ha elnavigálsz, bezárod a böngészőt vagy az alkalmazás újraindul, a következő megnyitáskor a `Continue Initial Intake in progress` állapot tölti vissza ugyanazt a nyitott kört és a mentett válaszokat.

Ne indíts pótkört megszakítás miatt. A szerver eleve megakadályozza, hogy ugyanahhoz a projekthez két nyitott kezdő kör legyen.

### A kérdéskártya értelmezése

Minden kérdésnél látható:

- a kérdés sorszáma és szövege;
- a téma és a válasz típusa;
- az ellenőrzési pont;
- a `Required question` jelzés, ha a hiány a felkészültségi értékelésben számít;
- a `Blocking clarification` jelzés és külön figyelmeztetés;
- a kérdésbanki hint;
- a típushoz tartozó válaszadási útmutató;
- választós kérdésnél az engedett opciók;
- a válasz mentési állapota.

Az útmutatás segít jó választ adni, de nem értékeli a tartalom szakmai minőségét. A rendszer például elfogadhat egy rövid szöveget technikailag, miközben az üzletileg még nem válaszolja meg a kérdést.

### Válaszadás a hét típusra

| Típus | Művelet | Mikor indul mentés? | Hogyan üríthető? |
| --- | --- | --- | --- |
| Rövid vagy hosszú szöveg | Gépelj a mezőbe | 750 ms gépelési szünet után | Töröld a teljes szöveget; az ürítés azonnal mentődik |
| Egyszeres választás | Válassz egy opciót | Azonnal | Válaszd a kezdeti üres lehetőséget |
| Többszörös választás | Jelölj egy vagy több opciót | Minden jelölésnél azonnal | Vedd ki az összes jelölést |
| Igen/nem | Jelöld be vagy kapcsold ki a yes jelölést | Azonnal | Nincs külön „nincs válasz” gomb; egy már kezelt kikapcsolt állapot no válasz |
| Szám | Írj véges számértéket | Érvényes változáskor azonnal | Ürítsd ki a mezőt |
| Dátum | Válassz vagy írj naptári napot | Változáskor azonnal | Ürítsd ki a dátummezőt |

Szöveges válasz után ne lépj azonnal tovább vagy ne zárd be az oldalt. Figyeld meg a kérdés alatti mentési állapotot.

| Látható állapot | Mit jelent? | Munkatársi teendő |
| --- | --- | --- |
| `Draft – awaiting automatic save` | A helyi szöveg még nem jutott el a szerverre | Maradj az oldalon; 750 ms gépelési csend után indul a mentés |
| `Saving…` | A mentési kérés úton van | Várd meg a végét a lezárás vagy elnavigálás előtt |
| `Saved` | A szerver megőrizte az értéket | Biztonságosan továbbléphetsz |
| `Not saved yet` | Nincs rögzített válasz | Kötelező kérdésnél adj választ |
| `Could not save…` | A szerver nem fogadta el vagy nem érte el a mentést | A piszkozat látható marad; stabil kapcsolat mellett válaszd a `Retry save` gombot |

Ha egy sikertelen szöveges mentés után tovább gépelsz, a képernyőn lévő legfrissebb piszkozat marad a kiindulópont. Mindig azt olvasd vissza, majd próbáld újra. Ne másold át automatikusan új körbe, mert az eredeti kör és a helyi piszkozat még helyreállítható.

### A felmérés lezárása

**Előfeltétel:** nincs várakozó automatikus mentés, nincs folyamatban lévő kérés és nincs mentési hiba. A felmérést minden esetben le lehet zárni: kész, részben kész vagy nem releváns tartalommal is. A hiányzó és részleges válaszok nem technikai lezárási akadályok; a felkészültségi értékelés és a későbbi tisztázások továbbra is láthatóvá teszik őket.

1. Görgess végig a kérdéseken, és ellenőrizd a mentési állapotokat.
2. Válaszd a `Complete intake and review gaps` műveletet, ha később készítenéd el a Customer összefoglalót, vagy a `Complete and preview interview summary` műveletet, ha rögtön előnézetet és küldést szeretnél.
3. Várd meg a `Complete` állapotot és az 1. felmérési összefoglaló piszkozatának megjelenését.

Függőben lévő vagy hibás technikai mentésnél a lezáró műveletek letiltva maradnak, hogy a képernyőn látható piszkozat ne vesszen el. A válasz tartalmi hiányossága azonban nem akadályozza meg a felmérés lezárását.

## Felmérés lezárása és felmérési összefoglaló

![Egy lezárt, részben kitöltött felmérés első felmérési összefoglalójának piszkozata címzettel, előnézettel, küldési művelettel és verzióelőzménnyel](assets/user-guide/09-interview-customer-handoff.png)

*Az előnézet a ténylegesen küldendő szöveget mutatja; a hiányzó válaszok láthatók maradnak, de a felmérés lezárását nem akadályozzák.*

### Első küldés most vagy később

A lezárás automatikusan létrehozza az 1. verziójú felmérési összefoglaló `Draft` állapotát. A címzett a projekt megnevezett ügyfélkapcsolattartója. Előnézet előtt a rendszer a konfigurált dedikált levelezési azonosítást mutatja; ez a küldő, nem szerkeszthető és nem választható helyette személyes postafiók.

- `Complete intake and review gaps`: a felmérés lezárul, majd a `Estimation Readiness` oldal nyílik meg; a felmérési összefoglaló később készíthető elő.
- `Complete and preview interview summary`: a felmérés lezárul, majd megnyílik az előnézet. A küldés csak a megerősítés után indul.

Küldés előtt mindig olvasd át a tárgyat, a címzett nevét és címét, valamint a HTML- és szöveges tartalmat. Az előnézet a válaszok aktuális tartalomverziójához kötött. Ha az előnézet után választ vagy értékelést módosítasz, készíts új előnézetet; az elavult előnézetet a szerver `409` konfliktussal visszautasítja.

### Állapotok és helyreállítás

| Állapot | Jelentés | Biztonságos következő lépés |
| --- | --- | --- |
| `Draft` | Szerkeszthető, még nem küldött verzió | Módosítás, előnézet, majd küldés |
| `Sending` | A küldési kísérlet folyamatban van | Ne indíts második küldést; várj vagy töltsd újra |
| `Accepted by mail gateway` | A levelezőrendszer elfogadta az átadást; ez nem kézbesítési vagy olvasási igazolás | Ügyfélmódosításhoz indíts új verziót |
| `Failed` | A levelezési gateway ismerten elutasította az átadást | Ellenőrizd az okot, majd válaszd az újrapróbálást |
| `Verification required` | Nem bizonyítható, hogy a megszakadt kísérlet kézbesített-e | Előbb ellenőrizd a postafiókot/szolgáltatót; csak ezután válaszd a folytatást |

Az `Accepted by mail gateway` verzió nem szerkeszthető. A `Failed` ugyanazt a változatlan előnézeti tartalmat próbálja újra. A `Verification required` nem automatikus újraküldési engedély: a rendszer azért áll meg, hogy ne küldjön észrevétlenül duplikált levelet.

### Ügyfél-visszajelzés és módosított újraküldés

1. Nyisd meg a korábban elküldött felmérési összefoglalót.
2. Válaszd a `Create new version` műveletet.
3. Írd le röviden, mit kért az ügyfél; a módosítási összefoglaló a 2. és későbbi verzióknál kötelező.
4. Az új piszkozat feloldja a felmérés válaszait és értékeléseit szerkesztésre. Módosítsd és várd meg minden mezőnél a mentést.
5. Készíts új előnézetet, ellenőrizd a teljes tartalmat, majd küldd el.

Az előző, elküldött verzió változatlanul megmarad. Egyszerre csak egy aktív, nem elküldött verzió lehet; ezért új verzió csak az előző sikeres küldése után indítható. Az új összefoglaló nem külön felmérési kör, hanem ugyanannak a lezárt felmérésnek a következő, nyomon követhető átadási verziója.

Archivált projektben a korábbi felmérési összefoglalók és tartalmuk továbbra is megnyithatók, de új verzió, szerkesztés, előnézet, küldés és újrapróbálás nem indítható. Aktív munka folytatásához előbb állítsd vissza a projektet.

Lezárás után újabb kezdő felmérési kört is indíthatsz. Az új kör az akkor legfrissebb projektsémáról készít új pillanatképet, és nem másolja automatikusan az előző kör válaszait.

## Felkészültségi értékelés és hiányok

![Elérhető felkészültségi értékelés összesített kitöltöttséggel, tényezőkkel és egy ellenőrzőlista-hiány javítására mutató művelettel](assets/user-guide/07-readiness-review.png)

*A `Estimation Readiness` oldalon látható értékelés a kanonikus kezdő felmérés aktuális állapotát, a tényezőket és a következő biztonságos javítási irányt mutatja; nem döntési pontszám és nem ajánlott döntés.*

### Mikor jelöld `Partially complete` vagy `Not applicable` értékre?

Minden kérdéskártyán az `Assessment` résznél a szerver által meghatározott tényleges állapot látható. Érvényes mentett válaszból `Complete`, válasz nélkül `Missing` lesz. Az `Automatic status` visszaállítja ezt a válaszból következő értéket.

- `Partially complete`: akkor használd, ha van mentett, érvényes válasz, de az üzleti tartalom még hiányos vagy ellenőrzésre szorul. Ez fél értékként számít a felkészültségben, de a felmérés lezárását nem akadályozza.
- `Not applicable`: csak akkor használd, ha az adott kérdés valóban nem alkalmazható erre a projektre. Add meg a `Rationale for not applicable` szöveget, majd válaszd a `Save rationale` gombot. Az indoklás kötelező, hogy a kizárás később értelmezhető legyen; az elem kimarad a kitöltöttségi és ellenőrzőlista-számításból.

Ne használd a `Not applicable` választ a hiányos információ elfedésére. Ha a kérdés releváns, de a válasz még nem elég jó, maradjon `Partially complete`, és kövesd a hiány javítását. Sikertelen értékelésmentésnél a beírt indoklás és a választott állapot a képernyőn marad; ellenőrizd a hibaüzenetet, majd válaszd a `Retry assessment` gombot. Lezárt felmérésben a vezérlők csak aktív felmérési összefoglaló piszkozata mellett szerkeszthetők.

### Az értékelés olvasása és javítása

Az értékelés a `Estimation Readiness` oldalon töltődik be. Elérhető állapotban ezt látod:

- `Intake completion`: a releváns ellenőrzőlista-elemek állapota; a `Not applicable` elemeket nem számolja.
- `Readiness`: a súlyozott összkép; a sáv jelzi, hogy pontosítás szükséges, becslés előkészíthető, becslésre kész vagy fejlesztésre kész.
- `Assessment factors`: külön mutatják az alapinformációk, az üzleti tisztázottság, a felelősség, az ellenőrzőlista és a tisztázandó tételek állapotát.
- `Gaps to resolve`: a `Critical`, `Important`, majd `Clarification` sorrendben megjelenő, általánosított javítási jelzések. A lista nem jelenít meg felmérési választ, `Not applicable` indoklást vagy tisztázandó tétel tartalmát.

Minden hiány művelete a megfelelő munkafelületre vezet: a koordinációs hiány a `Project Status` szerkesztőjéhez, a kérdéshiány a megfelelő felmérési kérdéshez, a tisztázási hiány pedig ugyanazon `Estimation Readiness` oldal tisztázandó tételeihez. Javítsd ott az adatot vagy zárd le a tételt, mentsd sikeresen, majd ellenőrizd a frissült értékelést.

### Ha az értékelés nem elérhető vagy nem töltődik be

| Látható helyzet | Jelentés | Biztonságos folytatás |
| --- | --- | --- |
| `No Initial Intake yet` | A projekthez nincs kiértékelhető kezdő felmérés | Nyisd meg a `Initial Intake` oldalt, tegyél közzé megfelelő sémát, majd indíts kezdő felmérést |
| `This assessment requires the complete 30-question general v1 schema` | A forráskör nem a jelenlegi kanonikus kérdéskészletet tartalmazza | Frissítsd a projektsémát, majd indíts új kezdő felmérést; ne próbáld a régi kört kézzel átírni |
| Betöltési hiba és `Retry` | A felkészültségi kérés nem fejeződött be | Ellenőrizd a kapcsolatot, válaszd az `Retry` gombot, és csak sikeres betöltés után hozz döntést az értékekből |

Az elérhetetlen vagy hibás értékelés nem akadályozza meg a projektkoordináció és a tisztázandó tételek kezelését. Mentsd ezeket a saját munkafelületükön; az értékelés helyreállása után ellenőrizd újra a hiányokat. A felkészültségi értékelés és a döntési pontszám egyaránt döntéstámogatás: egyik sem helyettesít üzleti döntést vagy készít automatikus kimenetet.

## Döntési értékelés és becslési ajánlás

A külön `Decision Review` oldal hat, projekt-szintű 1–5 értékelést tart meg: üzleti érték, stratégiai illeszkedés, sürgősség, bizonyosság, komplexitás és kockázat. A komplexitás és a kockázat fordított irányban számít. Az értékeket egyszerre, a `Save decision review` gombbal menti a rendszer; a hiányos értékelés megmarad, de nem kap részpontszámot vagy részleges ajánlást.

**Előfeltétel a pontszámhoz:** mind a hat érték megvan, és a projekt aktuális kezdő felmérése a teljes, kanonikus sémából ad elérhető felkészültséget. Enélkül az oldal megmondja, hogy melyik feltétel hiányzik. A projektkoordináció és a tisztázandó tételek ilyenkor is a megszokott módon szerkeszthetők.

A felület megjeleníti a `Decision score` értékét, annak `High` (legalább 65), `Medium` (40–64) vagy `Low` (40 alatti) címkéjét, a felkészültséget és a becslést blokkoló hiányok darabszámát. A kártya a súlyokat és a fordított irányt is megmutatja, de nem mutat külön dimenziónkénti részpontokat.

Az ajánlás sorrendje szándékosan szigorú:

1. `Clarification required`, ha van `Critical` hiány, a felkészültség 40% alatti, vagy kettőnél több becslést blokkoló hiány maradt.
2. `Ready for estimation`, ha a Score és a felkészültség is legalább 65, és nincs becslést blokkoló hiány.
3. `Ready for estimation preparation`, ha a Score legalább 40 és a felkészültség legalább 65.
4. Minden más esetben `Clarification required`.

Ezek az ajánlások önmagukban nem jóváhagyások: a rendszer nem változtat projektstátuszt, nem rögzít automatikusan Go/Conditional Go/No-Go döntést, és nem készít becslést vagy generált dokumentumot. A `Formal decisions` részen a döntéshozó külön, emberi művelettel rögzíthet formális `Go`, `Conditional Go` vagy `No-Go` döntést; ez döntési dátumot, döntéshozót, indoklást, valamint Conditional Go esetén feltételeket és felülvizsgálati dátumot őriz meg. Ha új `INITIAL_INTAKE` kör lesz aktuális, a hat megadott érték megmarad, de a Score és az ajánlás az új forrás felkészültségéből frissül. Archivált projektben az értékelés látható, de csak olvasható; visszaállítás után ismét menthető. Mentési vagy betöltési hiba esetén az oldal saját hibája és `Retry` művelete jelenik meg, a többi projektmunka nem akad el.

## Tisztázandó tételek kezelése

A tisztázandó tétel olyan üzleti munkaelem, amelynek van egyértelmű kérdése, felelőse, céldátuma és következő lépése. Nem ugyanaz, mint az ügyfél-emlékeztető: előbbi belső projektmunka, utóbbi ügyfélnek küldött üzenet.

![Egy megválaszolt üzleti és egy nyitott integrációs tisztázandó tétel felelőssel, dátummal és következő lépéssel](assets/user-guide/05-discovery-follow-ups.png)

*A lista külön mutatja a végleges döntést és a még nyitott, szerkesztésre vagy lezárásra váró tisztázást.*

![Nyitott tisztázandó tétel kompakt felmérési forráshivatkozással és annak kezelési műveleteivel](assets/user-guide/08-discovery-source-linkage.png)

*A forrás csak a sorszámát, témáját és kontrollpontját mutatja; a teljes checklist-kérdés kizárólag kiválasztáskor látható.*

### Kategóriák

| Kategória | Mikor válaszd? | Példa |
| --- | --- | --- |
| `BUSINESS` | Üzleti cél, döntési jog, érték vagy sikerkritérium | Ki hagyja jóvá az MVP scope-ját? |
| `SCOPE` | Be- és kizárt funkció, fázishatár vagy prioritás | Része-e az első kiadásnak a tömeges import? |
| `TECHNICAL` | Technikai megvalósíthatóság vagy architekturális korlát | Mekkora válaszidő elvárt csúcsterhelésen? |
| `DATA` | Adatforrás, adatgazda, minőség vagy migráció | Mely mezők hiányoznak a meglévő törzsadatból? |
| `INTEGRATION` | Külső vagy belső rendszerkapcsolat | Melyik rendszer adja az ügyféltörzsadatot? |
| `SECURITY` | Hozzáférés, adatvédelem, megfelelőség vagy auditigény | Mely szerepkör láthat személyes adatot? |
| `OPERATIONS` | Élesítés, support, üzemeltetési felelős vagy folytonosság | Ki fogadja az éles hibajegyeket? |
| `OTHER` | Egyik fenti kategóriába sem illő, mégis számonkérendő kérdés | Melyik külső workshop időpontja végleges? |

### Új tisztázandó tétel létrehozása

**Előfeltétel:** a projekt nem archivált, és nincs más tisztázandó tétel módosítása folyamatban.

1. A `Estimation Readiness` oldal `Discovery Follow-ups` részében válaszd ki a `Category` értékét.
2. A `Question requiring clarification` mezőbe egyetlen, megválaszolható tisztázást írj, legfeljebb 10 000 karakterben.
3. A `Owner` mezőben nevezd meg azt a személyt vagy egyértelmű szerepet, akinél a következő feladat van; legfeljebb 255 karakter használható.
4. A `Due date` mezőben valódi naptári céldátumot adj meg. Ez dátum, nem időpont.
5. Ha a tétel egy konkrét kezdő felmérési ellenőrzőpontból ered, a nem kötelező `Initial Intake source (optional)` listában válaszd ki. A lista a teljes kérdésszöveget is mutatja, hogy biztosan a megfelelő eredetet válaszd.
6. A `Next action` mezőben írd le, mi történik a válasz megszerzéséért, legfeljebb 10 000 karakterben.
7. Válaszd a `Create Discovery follow-up` gombot.

Üresen hagyhatod a forrást: a forrás nélküli tétel ugyanúgy létrejön. Ha nincs aktuális kezdő felmérés vagy nincs benne választható elem, ezt a lista jelzi, de a forrás nélküli létrehozást nem tiltja le. Ha a forráslista betöltése hibázik, válaszd a `Retry loading sources` műveletet; a meglévő hivatkozások és a forrás nélküli létrehozás közben használható marad.

Siker esetén az űrlap kiürül, zöld sikerüzenet jelenik meg, és az új tétel `Open` státusszal bekerül a listába. Audit-esemény is készül.

A lista a legkorábbi `Due date` szerint rendez. Azonos dátumnál a korábban létrehozott elem kerül előre. A rendszer jelenleg nem emeli ki automatikusan a lejárt tételt, ezért a dátumok napi ellenőrzése a munkát végző csapat feladata.

### Forrás kapcsolása, cseréje és eltávolítása

Nyitott, forrás nélküli tételnél válaszd az `Assign source`, meglévő forrásnál a `Change source` műveletet. A megjelenő választóban jelölj ki egy elemet, majd válaszd a `Save source` gombot. A lista mindig az aktuális felmérési forrást használja: előbb a legutóbb létrehozott nyitott, ennek hiányában a legutóbb lezárt kezdő felmérést. Egy később indított kör nem írja át a korábbi hivatkozást.

A forráskártya csak a sorszám, téma és control point rövid hivatkozását mutatja. A teljes forráskérdés csak a választóban segít azonosítani az elemet; az azonosító, a felmérési válasz és az értékelési indoklás nem jelenik meg itt.

Meglévő forrás eltávolításához válaszd a `Remove source link`, majd a megerősítésben ugyanezt a gombot. A `Cancel` semmit nem módosít. Erősítsd meg csak akkor, ha biztos vagy benne: egy későbbi kezdő felmérés miatt a régi forrás később már nem lesz visszaválasztható. A megerősítés alatt más tisztázási módosítás nem indítható.

Ha mentéskor ütközés vagy elavult forrás jelenik meg, a választásod megmarad. Frissítsd a forrásjelölteket, ellenőrizd az aktuális kezdő felmérés állapotát, majd tudatosan válassz újra. Egyszerre csak egy szerkesztési, lezárási vagy forráshivatkozási űrlap lehet nyitva.

### Nyitott tisztázandó tétel napi szerkesztése

Csak `Open` tisztázandó tétel szerkeszthető. A kívánt sorban válaszd a `Edit Discovery follow-up` gombot, majd szükség szerint módosítsd az öt munkamezőt: `Category`, `Question requiring clarification`, `Owner`, `Due date` és `Next action`. Az állapot, a végleges döntés vagy válasz és az elem azonosítója nem szerkeszthető.

1. Ellenőrizd a sorba betöltött értékeket, és javítsd a szükséges mezőket.
2. A `Due date` mezőbe valódi naptári dátumot adj meg; ez nem időpont.
3. Válaszd a `Save changes` gombot. Siker esetén a lista az új dátum szerint rendeződik, és újratöltés után is a mentett értékeket mutatja.
4. Ha nem akarod megtartani a helyi változtatást, válaszd a `Cancel` gombot. Ez nem küld mentést.

Ha az öt mező a megnyitott értékkel azonos marad, nincs mentendő változás: a `Save changes` nem indít felesleges írást, és a verzió sem változik.

Egyszerre csak egy szerkesztési vagy lezárási űrlap lehet nyitva. Ha más közben szerkeszti, lezárja vagy archiválja a projektet, a mentés ütközést jelezhet. Ilyenkor a beírt piszkozat megmarad, a lista a legfrissebb állapotra frissül, és a mentés nem ír felül senkit. Ne töltsd újra általánosan az oldalt, mert ez eldobná a megőrzött helyi szerkesztőpiszkozatot. Ha a frissítés sikertelen, válaszd a `Retry refresh` műveletet. Csak sikeres frissítés után válaszd nyitott tételnél a `Load current version` gombot, hasonlítsd össze az értékeket, majd szükség esetén írd be újra a saját változtatásodat és mentsd el. Ha a frissített tétel már lezárt, nem szerkeszthető és nem tölthető vissza szerkesztésre; a piszkozatot csak a `Cancel` gombbal vetheted el.

### Csatolmányok

A csatolmány nem általános dokumentumtár. Két külön típus használható:

- a `Question Bank` referenciafájl az Operator szervezet közös kérdésváltozatához
  tartozik; a közzétett kérdésbank-verzió és az azt kiválasztó projektséma mindig
  ugyanazt a pontos referenciafájl-készletet őrzi;
- a projektmunka-csatolmány egy projekten belül egy Initial Intake
  ellenőrzőlista-kérdéshez vagy egy tisztázandó tételhez tartozik.

Projektmunka-csatolmányként PDF; Word-, RTF- és OpenDocument-szöveg (`.doc`,
`.docx`, `.rtf`, `.odt`); Excel-, CSV- és OpenDocument-táblázat (`.xls`, `.xlsx`,
`.csv`, `.ods`); PowerPoint- és OpenDocument-bemutató (`.ppt`, `.pptx`, `.odp`);
UTF-8 TXT és Markdown (`.txt`, `.md`); PNG és JPEG; valamint Microsoft Project
és Visio (`.mpp`, `.vsdx`) tölthető fel. Az alapértelmezett felső határ 50 MiB;
a telepítés ezt alacsonyabb értékre állíthatja. A generikus archívumok és futtatható
fájlok nem engedélyezettek, a letöltés pedig mindig fájlletöltésként indul.

Archivált projektben új munka-csatolmány feltöltése vagy eltávolítása nem
lehetséges, de a megőrzött munka-csatolmány letölthető marad. A Question Bank
korábbi referenciafájljai és az azokkal létrehozott projektsémák szintén
olvashatók maradnak. Evidence-ként felhasznált projektmunka-csatolmányt előbb
az Evidence hivatkozás megszüntetése nélkül nem lehet eltávolítani.

A Kezdeti felmérés kérdéséhez tartozó fájl ugyanaddig módosítható, mint maga a
válasz: nyitott körben, illetve lezárás után addig, amíg nincs kiküldött Customer
handoff. A már elküldött handoff nem ismétlődik meg, és a hozzá tartozó történeti
fájl csak letölthető. Egy lezárt tisztázandó tétel fájljai szintén megmaradnak,
de már nem bővíthetők és nem távolíthatók el.

### Tisztázandó tétel lezárása

Egy nyitott elem csak egyszer zárható le, két terminális státusz egyikére:

- `Answered`: érdemi döntés vagy válasz született;
- `Not applicable`: a kérdés már nem tartozik a projekthez, és ennek indokát meg kell őrizni.

1. A kívánt tételen válaszd a `Resolve` gombot.
2. Válaszd ki a `Resolution type` értéket.
3. A `Decision or answer` mezőben rögzítsd a választ, döntést vagy a nem releváns minősítés okát.
4. Ellenőrizd, hogy a szöveg önmagában is érthető egy későbbi átadásnál.
5. Válaszd a `Save resolution` gombot.

Egyszerre csak egy lezárási űrlap lehet nyitva; amíg az aktív, a többi `Resolve` gomb letiltva marad. A `Cancel` bezárja az űrlapot, és nem változtatja meg a tételt.

Siker után a `Edit Discovery follow-up` és a `Resolve` gomb is eltűnik, megjelenik a végleges állapot és a `Decision or answer`.

### Mi nem módosítható?

Lezárt (`Answered` vagy `Not applicable`) tisztázandó tétel nem szerkeszthető, nem nyitható újra, és a megőrzött forrása sem módosítható. Tételtörlés nem elérhető. Hibás, még nyitott kérdés, felelős vagy dátum esetén a `Edit Discovery follow-up` folyamatot használd; lezárt tételt ne próbálj hamis válasszal helyesbíteni. Ha valóban új tisztázandó kérdés keletkezik, hozz létre új tételt.

### Archivált projekt

Archiválás után a tisztázandó tételek listája és a kompakt forráshivatkozások olvashatók maradnak, de az új elem létrehozása, a `Edit Discovery follow-up`, a `Resolve` és a forráshivatkozási műveletek letiltottak. Ha archiváláskor nyitva volt egy helyi szerkesztő-, lezárási vagy forráshivatkozási űrlap, illetve eltávolítási megerősítés, annak be nem mentett állapota törlődik. Visszaállítás után az archiválás előtti projektfázis és mentett felmérési állapot folytatódik, a meglévő tételek megmaradnak, és a nyitott elemek műveletei újra elérhetővé válnak.

Ha archivált állapotban kell valódi új döntést rögzíteni, előbb válaszd a `Restore project` műveletet, ellenőrizd a folytatott mentett állapotot, majd végezd el a tisztázási műveletet.

## Ügyfél-emlékeztetők

A projekt ügyfél-emlékeztető folyamata két összetartozó, de külön munkafelületű műveletből áll:

1. a `Project Settings` oldali emlékeztető-beállítások egy jövőbeli automatikus emlékeztető-sorozatot vezérelnek;
2. a `Customer Follow-up` munkafelületen a mentett piszkozatból ellenőrzött előnézet után egyetlen kézi ügyfél-emlékeztető küldhető.

Mindkettő a projekt létrehozásakor rögzített `Customer contact email` mező értékére küld. A címzett nem írható felül. A kézi küldés előtt a rendszer küldési előnézetben mutatja a címzettet, a tárgyat és a teljes egyszerű szöveges levelet. A Claude Code-nak szánt Markdown és a felmérési összefoglaló nem része ennek a levélnek.

A felmérési összefoglaló az egyetlen teljes ügyfél-összefoglaló küldési folyamat. Az ügyfél-emlékeztető rövid, célzott levél: nem alternatív felmérési összefoglaló, nem csatol specifikációverziót vagy `.md` fájlt, és nem továbbít belső Claude-instrukciót.

### Automatikus emlékeztető beállítása

**Mikor használd?** Ha előre meghatározott időközönként ugyanannak a kapcsolattartónak emlékeztetőt kell kapnia egy nyitott tisztázási kérdésről.

| Mező | Jelentés |
| --- | --- |
| `Enable automated Customer follow-ups` | Bekapcsolja vagy kikapcsolja az automatikus ütemezést |
| `Delivery interval (minutes)` | Két tervezett emlékeztető közötti idő, 1 és 525 600 perc közötti egész szám |
| `Automatic delivery end date` | Nem kötelező jövőbeli lejárati időpont; üresen nincs időalapú lejárat |

Az alapértelmezett időköz 10 080 perc, vagyis hét nap, de ez csak kiindulási érték. A projekt valós kommunikációs megállapodása szerint állítsd be.

1. A `Customer Follow-up` munkafelületen előbb ments egy nem üres ügyfél-emlékeztető piszkozatot.
2. Nyisd meg a `Project Settings` oldalt.
3. Állítsd be az engedélyezést, a küldési időközt és szükség esetén az automatikus küldés végét.
4. Engedélyezett ütemezésnél a lejárat csak jövőbeli időpont lehet.
5. Válaszd a `Save follow-up settings` gombot.
6. Ellenőrizd az `Automated follow-ups`, `Delivery interval` és `Automatic delivery end date` összefoglalót.

Ha bekapcsolod az automatikát, a következő emlékeztető a mentés időpontjától számított időköz alapján ütemeződik. Ha kikapcsolod, a `Next automated follow-up` megszűnik. Üres végdátum esetén az ütemezés nem jár le magától; a csapatnak kell kikapcsolnia vagy archiválnia a projektet.

Engedélyezéskor a rendszer ellenőrzi, hogy a levélküldés szervezetileg be van-e állítva. Ha nincs, a mentés hibával leáll, és az előző beállítás marad érvényes. Ilyenkor ne próbálkozz másik címzettel vagy ismételt kattintással; kérd az üzemeltetőt a levélküldés beállításának ellenőrzésére.

Az automatikus küldés ugyanazt a mentett piszkozatot és nem kötelező tisztázási hivatkozást használja, mint a kézi emlékeztető. Minden esedékességkor újraolvassa az aktuális ügyfélkapcsolatot, piszkozatot és hivatkozást. Üres piszkozat vagy időközben lezárt hivatkozás mellett nem küld levelet.

Ha az esedékességkor a piszkozat vagy a hivatkozás már nem érvényes, az automatikus ütemezés bekapcsolva marad, de a következő emlékeztető átmenetileg `Not scheduled` állapotú lesz, és megjelenik az `Automated Customer follow-up is paused` figyelmeztetés. Javítsd vagy távolítsd el a hivatkozást, majd mentsd újra az érvényes piszkozatot; ezzel a rendszer új időpontot ütemez. Ilyenkor nem történt levélküldési kísérlet.

### Az emlékeztető állapotának értelmezése

| Megjelenő adat | Jelentés |
| --- | --- |
| `Enabled` / `Disabled` | Az automatikus ütemezés mentett állapota |
| `Latest follow-up` | A legutóbbi automatikus vagy kézi küldési kísérlet ideje; kezdetben `Not sent yet` |
| `Next automated follow-up` | A következő automatikus kísérlet tervezett ideje; kikapcsolva `Not scheduled` |
| `Not sent yet` | Még nem volt kézbesítési kísérlet |
| `Accepted by the mail system for delivery` | A legutóbbi emlékeztető küldése sikeres volt |
| `Customer follow-up delivery failed` | A legutóbbi emlékeztető küldése nem sikerült |
| `Delivery issue` | Biztonságos hibaértelmezés; nem tartalmaz levél- vagy hitelesítési titkot |

A `Accepted by the mail system for delivery` azt igazolja, hogy a levelezési szolgáltatás elfogadta a küldést. Nem bizonyítja, hogy a címzett elolvasta, jóváhagyta vagy válaszolt rá.

Ismert gateway-elutasításkor a felület `Customer follow-up delivery failed` állapotot mutat, a következő automatikus időpont pedig a beállított időköz szerint megmarad. A hibás próbálkozás külön kézzel is újrapróbálható. Bizonytalan kimenetnél az automatikus ütemezés szünetel: előbb ellenőrizd a kimenő postafiókot, majd csak a külön kockázatelfogadással indított újrapróbálás sikeres befejezése ütemezi a következő emlékeztetőt.

Lejárat után az automatikus feldolgozás kikapcsolja az ütemezést és törli a következő emlékeztető időpontját. Archiváláskor az engedélyezett ütemezés és a következő küldésig hátralévő idő megmarad, de automatikus levél nem indul. Visszaállításkor a hátralévő idő folytatódik; ha az emlékeztető már archiválás előtt esedékes volt, egy teljes új időköz indul. Az archiválás alatt kimaradt küldéseket a rendszer nem pótolja, korábbi vagy bizonytalan kimenetű kísérletet nem ismétel meg, és a közben lejárt végdátumot nem hosszabbítja meg.

### Egyetlen kézi emlékeztető küldése

> **Külső hatás — küldés előtt ellenőrizd:** a `Send to Customer` valódi levelet indít az üzemeltető szervezet konfigurált dedikált levelezési azonosításától a mutatott címzettnek. Ha bármelyik adat hibás, válaszd a `Cancel` gombot.

A kézi emlékeztető akkor is használható, ha az automatikus ütemezés kikapcsolt. A piszkozat kötelező, a kapcsolódó nyitott tisztázandó tétel nem kötelező. A levélbe csak a megírt üzenet, valamint választás esetén a kérdés, a következő lépés és a határidő kerül. A felelős, kategória, válasz vagy döntés, forráshivatkozás, azonosítók, belső eseményadatok, Markdown és Claude-instrukciók kimaradnak. A piszkozat környező szóközeit a rendszer levágja; a mentett tartalom nem lehet üres és legfeljebb 10 000 karakteres.

1. Nyisd meg a `Customer Follow-up` munkafelületet, írd meg a `Message to Customer` mezőt, és szükség esetén válassz egy nyitott tisztázandó tételt.
2. Válaszd a `Save draft` gombot. Ha közben más mentett, a saját szöveged megmarad; csak a `Reload current draft` írja felül. Az automatikus ütemezés ettől külön, a `Project Settings` oldalon kezelhető.
3. Ellenőrizd a mutatott dedikált levelezési azonosítást. Ez az üzemeltető szervezet által konfigurált, rögzített küldő; személyes vagy másik feladó nem választható.
4. Válaszd a `Preview delivery` gombot, majd ellenőrizd a feladót, a címzettet, a tárgyat és a teljes levélszöveget.
5. A `Cancel` visszavisz az előnézetet megnyitó gombra. A `Send to Customer` egyszer használható előnézeti tokennel indítja a levelet.
6. Várd meg az `Accepted by the mail system for delivery.` sikerüzenetet, majd ellenőrizd a legutóbbi emlékeztető és kézbesítési kísérlet állapotát. Ez a levelezőrendszer elfogadását bizonyítja, nem a kézbesítést vagy az olvasást.

Ha az előnézet óta megváltozik a címzett, a piszkozat vagy a hivatkozott tisztázandó tétel, a küldés konfliktussal leáll. Töltsd újra az aktuális állapotot, mentsd újra a szándékos módosítást, és készíts új előnézetet. Sikertelen gateway-küldéskor biztonságos állapot és redaktált belső esemény marad; a címzett és a levél szövege nem kerül a technikai eseményadatokba. Ugyanazon küldés újrapróbálása megtartja a levél tartalmát és válaszcímét; egy későbbi új emlékeztető új küldési azonosságot kap.

Amíg egy kézi küldés folyamatban van, az emlékeztető munkafelület saját módosításai letiltva maradnak. A felület rövid időközönként újraolvassa ezt az állapotot, ezért a bizonyított siker, hiba vagy a 15 perces zárolás lejárata oldalfrissítés nélkül feloldja a műveleteket. Ha a gateway-kérés eredménye a levél átadása után nem bizonyítható, a rendszer bizonytalan állapotot őriz meg. Ellenőrizd a kimenő postafiókot. Változatlan piszkozatnál csak ezután válaszd az `I have checked; retry delivery`, majd a `Accept risk and retry` műveletet. Ha közben szándékosan módosítottad a piszkozatot, mentsd el, készíts friss előnézetet, majd azon válaszd a `Accept risk and send again` műveletet.

Archivált projektben a mentett emlékeztető olvasható marad, de a szerkesztés, előnézet és küldés letiltott. Ha a munka valóban újraindult, előbb állítsd vissza a projektet, ellenőrizd a címzettet és a hivatkozott tisztázandó tétel nyitott állapotát, majd készíts friss előnézetet.

### Nem társított ügyfélüzenetek feldolgozása

A `Portfolio Overview` `Correspondence Mailbox` paneljéről nyisd meg az `Unmatched messages` oldalt. Ide kerül az a beérkezett levél, amelyet a rendszer nem tud egyetlen ügyféllevelezéshez sem biztonságosan hozzárendelni. A bizonytalan automatikus levelek szintén itt maradnak kézi ellenőrzésre; önmagukban nem hoznak létre `New response` állapotot.

1. Ellenőrizd a feladót, a tárgyat, a látható üzenetrészt, az időpontot és a mellékletek számát.
2. Ha valódi ügyfélválasz, válaszd ki a megfelelő aktív projekt ügyféllevelezését, majd válaszd az `Assign message` műveletet.
3. Ha az üzenet nem tartozik projektmunkához, válaszd a `Not applicable` műveletet.
4. A döntés explicit, idempotens és auditált. A társítás után az üzenet egyszer jelenik meg a kiválasztott levelezésben, és egyszer növeli az olvasatlan számlálót.

A kézbesítési jelentések és az automatikus távolléti válaszok külön mail-system event listában láthatók. Nem számítanak ügyfélválasznak, ezért nem növelik az olvasatlan számlálót. A dedikált postafiókból visszaérkező saját leveleket a rendszer figyelmen kívül hagyja. Outlookban végzett áthelyezés, olvasottra állítás vagy törlés nem módosítja a már importált Project Maker adatot.

Ha a postafiók kapcsolata átmenetileg megszakad, a rendszer korlátozott számú, késleltetett újrapróbálást végez; konfigurációs vagy hitelesítési hibánál nem indít ismétlési vihart. Érvénytelen IMAP UIDVALIDITY ellenőrzőpont esetén új baseline készül: a már importált adatok megmaradnak, a baseline történeti levelei pedig nem jelennek meg új válaszként.

## Specifikációverziók és átadási pillanatképek

![A specifikációverziók legfrissebb eleme, metaadatai, változásösszefoglalója és tartalmi előnézete](assets/user-guide/06-markdown-revisions.png)

*A bal oldali lista a verziótörténet, a jobb oldal az éppen kiválasztott, változatlan forrás- és tartalompillanatkép.*

### Mit jelent a specifikációverzió?

A specifikációverzió egy adott időpont projektállapotának változatlan, kanonikus Markdown-specifikációja. A kiválasztott publikált sablon biztonságos helyőrzőkön keresztül jeleníti meg a projekt-, felmérési, felkészültségi és döntési értékelési adatokat. Nem a projekt élő nézete: egy későbbi adat- vagy sablonmódosítás nem írja át.

A forráspillanatkép jelenleg tartalmazza:

- a projekt nevét, kapcsolattartóját és koordinációs adatait;
- a létrehozáskor elérhető legfrissebb projektsémát és annak kérdéseit;
- a projekt addigi felmérési köreit;
- a körök kérdéspillanatképeit és mentett válaszait;
- a specifikációverzió létrehozási okát, verzióját és időpontját.

A nem kötelező sablonblokkok a közvetlenül előttük álló címsorral együtt kimaradnak, ha a hozzájuk tartozó adat még nem elérhető. A kötelező helyőrző hiánya ehelyett az érintett előkészítési adat magyar nevét megadó hibaüzenettel leállítja a generálást. A specifikációverzió továbbra sem tartalmazza:

- a tisztázandó tételek listáját, döntéseit vagy felelőseit;
- az ügyfél-emlékeztető ütemezését és állapotát;
- a később, más specifikációverzió után beírt adatokat.

Ezért átadáskor a Markdown mellett külön ellenőrizd a `Estimation Readiness` oldal tisztázandó tételeit is.

### Az első specifikációverzió létrehozása

Specifikációverzió nélkül a `Version history` rész a `No specification versions yet` állapotot mutatja.

1. A projekt közös navigációjában nyisd meg a `Project Specification` oldalt.
2. A `Published template` mezőben válaszd ki a dokumentum szerkezetét. Az első alkalommal az `Default project plan`, később a projekt utolsó sikeres választása jelenik meg.
3. A `Generation reason` mezőben válassz okot.
4. Szükség esetén add meg a `Milestone` nevét.
5. Válaszd a `Generate specification version` gombot.
6. Várd meg, amíg a verzió megjelenik a listában és a `Specification version details` betöltődik.

| Ok | Mikor használd? | Mérföldkő mező |
| --- | --- | --- |
| `Manual generation` | Ad hoc belső ellenőrzés, átadás vagy küldés előtti friss pillanatkép | Hagyd üresen |
| `Milestone reached` | Névvel jelölt üzleti ellenőrzési pont | Kötelező, legfeljebb 255 karakter |

A `Handed over for planning` adminisztratív projektfázis beállítása automatikusan `Milestone reached` okú specifikációverziót hoz létre. Ezt nem kell még egyszer kézzel megismételni, hacsak egy későbbi adatmódosításról nem akarsz új pillanatképet.

### A verziótörténet olvasása

A legújabb specifikációverzió van elöl. Egy listaelem megmutatja a verziószámot, az okot, az opcionális mérföldkőnevet és a létrehozási időt. A kiválasztott elem kiemelt.

A részletek jelentése:

| Adat | Jelentés |
| --- | --- |
| `Created` | Mikor készült a változatlan specifikációverzió |
| `Milestone` | A névvel jelölt üzleti ellenőrzési pont, vagy `None` |
| `Source version` | A specifikációverzió saját forráspillanatképének verziója |
| `Template` | A generáláskor használt sablon neve és változatlan publikált verziója |
| `Previous version` | Link a közvetlen előző specifikációverzióhoz, vagy `First version` |
| `Change summary` | Rövid rendszer-összefoglaló arról, mely tartalmi területek változtak |
| `Content preview` | A letölthető Markdown tényleges szövege |

A változásösszefoglaló tájékoztató jellegű. Nem helyettesíti a teljes előnézet elolvasását, és nem minősíti üzletileg helyesnek a változást.

Készíthető új specifikációverzió akkor is, ha az adatok nem változtak. Ilyenkor új, változatlan verzió jön létre, és az összefoglaló jelezheti, hogy nincs érdemi tartalmi eltérés. Ne generálj ismételt verziókat pusztán azért, mert nem vártál eleget a lista frissülésére.

### Letöltés és felhasználás

1. Válaszd ki a megfelelő specifikációverziót a bal oldali listából.
2. Ellenőrizd a verziót, az okot, a forrásverziót és a változásösszefoglalót.
3. Olvasd végig a `Content preview` részt, benne a kapcsolattartói és válaszadatokkal.
4. Válaszd a `Download Markdown` hivatkozást.

A letöltött fájl neve `execution-plan.md`. A fájl egy másolat; módosítása nem változtatja meg a Project Makerben tárolt specifikációverziót. A webappban nincs verziószerkesztés vagy törlés. Javítás esetén módosítsd az élő projektadatot, várd meg a válaszmentéseket, majd generálj új specifikációverziót.

### Betöltési és létrehozási hiba

- Ha a lista nem töltődik be, válaszd a `Reload versions` gombot.
- Ha csak a kijelölt specifikációverzió részlete hibás, válaszd a `Reload specification version` műveletet vagy nyiss meg másik listatételt.
- Ha a specifikációverzió időközben nem található, térj vissza a listához, és válassz létező elemet.
- Ha generáláskor mezőhiba jelenik meg, javítsd a `Milestone` értékét.
- Ha a projektadat közben változott, töltsd újra az oldalt és szándékosan generálj új pillanatképet; egy korábbi specifikációverziót ne tekints élő állapotnak.

> **Archivált projekt:** a specifikációverziók olvashatók maradnak, de új verzió nem generálható. Előbb állítsd vissza a projektet.

### Specifikációs sablonok kezelése

A globális navigáció `Specification templates` oldalán több szervezeti specifikációs sablon tartható fenn.

1. Válaszd a `New template` gombot, adj nevet és szerkeszd a Markdown forrást.
2. A `Save draft` még nem módosítja a projektek számára elérhető publikált verziót.
3. A `Preview` reprezentatív, nem éles projektadatokkal ugyanazt a szerveroldali renderert futtatja.
4. A `Publish` változatlan, sorszámozott verziót hoz létre. A következő szerkesztés új piszkozat és új publikált verzió lesz.
5. A `Project Specification` oldalon csak publikált verzió választható. Egy már létrejött specifikációverzió mindig megtartja a használt sablon nevét, verzióját és kész tartalmát.

A felsorolt helyőrzők zárt, dokumentált készletet alkotnak; a felület mindegyiknél jelzi a magyar megnevezést és azt, hogy az adat mindig rendelkezésre áll-e, vagy nem kötelezően elhagyható. A `?` jelölés (például `{{project.readiness?}}`) külön Markdown blokkban álló, nem kötelező teljes blokkot jelent; ismeretlen, hibás vagy szövegbe ágyazott nem kötelező helyőrzővel a piszkozat nem menthető vagy publikálható. A sablon nem futtat kódot és nem fér hozzá nyers belső eseményadatokhoz.

## Fejlesztési csomag, Git-átadás és Claude Code

### Fejlesztési csomag készítése

A projekt `Delivery Package` oldalán válassz egy pontos specifikációverziót, majd szerkeszd a fejlesztési tételek címét, user story-ját és elfogadási kritériumait. A forrásrészlet nem kötelező kézi szerkesztésnél, de ha megadod, annak szó szerint szerepelnie kell a kiválasztott specifikációban. A mentés közös fejlesztési csomagot hoz létre; nincs külön jóváhagyási státusz vagy kötelező második személy.

A mentett fejlesztési csomagból közvetlenül elérhető:

- a Markdown letöltés;
- a magyar karaktereket megtartó CSV;
- a böngésző nyomtatási nézete, amelyből PDF menthető.

Archivált projektben a megtartott fejlesztési csomag és kimenetei továbbra is olvashatók és letölthetők, de új mentéshez előbb vissza kell állítani a projektet.

### Közös Git setup és átadás

A globális `Git connections` oldalon bármely belső felhasználó létrehozhatja és szerkesztheti a telepítés közös SSH- vagy HTTPS-beállításait. A név, remote, branch, opcionális repository-link és a credential menthető; a listában a credential tartalma nem jelenik meg. Nincs setup-tulajdonos vagy külön kezelői jogosultság.

Git-átadáshoz:

1. Mentsd a fejlesztési csomag aktuális változatát.
2. Válaszd ki a közös Git setupot.
3. Készíts `Create Git preview` előnézetet, és ellenőrizd a remote-ot, branchet, fájlnevet, commitüzenetet és a teljes átadandó tartalmat.
4. Csak ezután válaszd a `Confirm preview and push to Git` műveletet.
5. Ellenőrizd az átadási történetben a sikeres állapotot és a commit SHA-t.

Ha a fejlesztési csomag vagy a Git setup az előnézet után megváltozik, a megerősítés nem használja a régi előnézetet: készíts újat. Bizonytalan push-eredménynél a rendszer az elvárt commit SHA-val ellenőrzi a remote-ot; csak a meg nem erősített hiba marad kézzel újrapróbálható. Az ügyféllevelezés egyik ága sem használja ezt a fejlesztési csomagot vagy Git setupot.

### Claude Code egyszeri összekapcsolása

A Project Maker nem futtat AI-modellt, és nem kér Claude API-kulcsot. A saját Claude Code előfizetésed végzi a modellhasználatot; a Project Maker MCP-kapcsolata csak a meglévő alkalmazásműveleteket teszi elérhetővé.

1. Jelentkezz be a webappba, és nyisd meg a `Account settings` oldalt.
2. A `Claude Code connection` kártyán válaszd a `Create connection token` gombot.
3. Másold ki és egyszer futtasd a mutatott `claude mcp add` parancsot a saját gépeden.
4. Claude Code-ban a `/mcp` paranccsal vagy a `claude mcp get project-maker` paranccsal ellenőrizd a kapcsolatot.

A token csak létrehozáskor látható. Ha elveszett, az `Create new token` azonnal lecseréli a régit; a `Revoke connection` és a fiók letiltása érvényteleníti. Ez nem új szerepkör: mindenki pontosan a saját belső felhasználójaként, a webappal azonos képességekkel dolgozik.

Claude Code a kapcsolaton keresztül tudja:

- listázni a projekteket, lekérni a projektkontextust és olvasni vagy generálni a specifikációverziót;
- menteni a fejlesztési csomagot;
- listázni a közös Git setupokat, majd külön előnézetet kérni és annak tokenjével megerősíteni az átadást;
- olvasni és módosítani a Question Bankot;
- listázni, menteni és publikálni a Markdown sablonokat.

Nincs általános adatbázis- vagy fájlrendszer-hozzáférés, és nincs ügyféllevél-küldő MCP művelet. A Git-átadás Claude Code-ból is ugyanazt a kétlépcsős előnézet–megerősítés szabályt használja: a megerősítő tool minden alkalommal külön emberi jóváhagyást kér, akkor is, ha más Project Maker toolokat korábban már engedélyeztél.

## Legutóbbi aktivitás és technikai audit

A `Project Status` oldal `Recent Activity` kártyája az alkalmazotti munkához szükséges, legfeljebb öt legfrissebb üzleti eseményt mutatja emberi nyelvű összefoglalóval és időponttal. A rendszer előbb kizárja a belső diagnosztikai eseményeket, és csak ezután választja ki az öt legfrissebbet.

A teljes technikai audit továbbra is megmarad üzemeltetési és bizonyítási célra, de nem része az alkalmazotti felületnek. Nyers eseménykódot, technikai adattartalmat vagy ügyféltartalmat ne keress és ne másolj a napi projektmunkába. Ha részletes technikai bizonyíték szükséges, azt az üzemeltető a védett API- és adatbázis-határon ellenőrizze.

A Project Maker auditja azonosítja a bejelentkezett belső felhasználót, de nem teljes mezőszintű módosításnapló és nem formális jóváhagyási bizonyíték. Ha külön jóváhagyó személy vagy szervezeti felelősségi folyamat szükséges, azt továbbra is külön szervezeti kontrollnak kell biztosítania.

## Archiválás, visszaállítás és végleges törlés

Az archiválás és a törlés üzleti jelentése teljesen különböző:

- archiváláskor a projekt, a válaszok, tisztázandó tételek, specifikációverziók és belső események megmaradnak;
- törléskor maga a jogosult korai projekt végleg megszűnik.

### Archiválás — az alapértelmezett lezárási mód

**Mikor használd?** Ha az aktív igényfelmérés és -tisztázás befejeződött vagy szünetel, de a projekt története később még kellhet.

1. Győződj meg róla, hogy nincs koordinációmentés, tisztázandó tétel lezárása vagy e-mail-küldés folyamatban.
2. Ellenőrizd, hogy a legfontosabb válaszok és döntések mentve vannak.
3. Szükség esetén generálj záró specifikációverziót.
4. Válaszd a `Archive project` gombot.
5. Várd meg a `The project has been archived.` sikerüzenetet és az `Archived` állapotot.

Az archivált projekt megőrzött adatai elérhetők maradnak. A koordináció, az ügyfél-emlékeztető műveletei, valamint a tisztázandó tétel létrehozása és lezárása letiltott. A projektoldalak, a megőrzött tartalom és a legutóbbi üzleti aktivitás továbbra is olvasható; a specifikációverziók, csatolmányok és Delivery package exportok továbbra is letölthetők.

A jelenlegi kiadásban a `Initial Intake` és a `Project Specification` közvetlen útvonala archiválás után is megnyitható lehet. Ezt ne értelmezd engedélyként új tartalom létrehozására. A biztonságos szabály: előbb `Restore project`, utána új séma, kör, válasz vagy specifikációverzió.

### Visszaállítás

1. Nyisd meg az `Archived` projektet a Portfolio Overviewból.
2. Válaszd a `Restore project` gombot.
3. Várd meg az archiválás előtti fázist megnevező sikerüzenetet.
4. Ellenőrizd a folytatott adminisztratív fázist, felmérési állapotot, felelőst, következő lépést és határidőt.

A visszaállítás az archiválás előtti adminisztratív fázist, kérdéssémát, aktuális felmérési kört, válaszokat, értékeléseket, tisztázandó tételeket, specifikációkat és más mentett projektmunkát folytatja. Maga a visszaállítás nem hoz létre új felmérési kört, specifikációverziót, ügyféllevelet, emlékeztetőt, Git-átadást vagy más korábbi eseményt. A már megtörtént küldések és bizonytalan kézbesítési eredmények változatlan előzmények; újrapróbálásuk továbbra is külön, explicit művelet.

Ha archiválás előtt nyitva maradt egy be nem mentett tisztázási lezáró űrlap, annak piszkozata nem áll vissza. Nyisd meg újra a tételt, és a forrásból ellenőrzött választ rögzítsd.

### Végleges törlés

> **Visszafordíthatatlan művelet:** a sikeres `Permanently delete project` után nincs visszaállítás vagy kuka. Csak olyan `In preparation` állapotú projektet törölj, amelynek belső munkaadataira biztosan nincs szükség. Ügyfélkommunikáció vagy Git-átadás után mindig archiválj.

A törlési kártya csak `In preparation` állapotban látható. Sikeres megerősítéskor a projekt és minden hozzá tartozó belső munkaadat egyetlen műveletben végleg törlődik. Ide tartozhat az audit, a kérdésséma és felmérési piszkozat, a válasz, a tisztázandó tétel, a specifikáció, a csatolmány, az Insight, a belső döntés vagy státusz és a még át nem adott Delivery package.

Törlést mindig akadályoz:

- ha a projekt adminisztratív fázisa már nem `In preparation`;
- bármely ügyfélküldés, küldési kísérlet, ügyfélválasz, ügyfél-válaszkérés vagy kapcsolt levelezési előzmény;
- bármely Git-átadási előzmény, annak eredményétől függetlenül.

A pusztán belső audit, séma, felmérés, specifikáció vagy más belső draft-adat nem blokkolja a tudatos törlést. A szerver a megerősítés pillanatában újra ellenőrzi a fázist és a megőrzendő Customer/Git történetet; mindig a törlési válasz az irányadó.

1. Válaszd a `Permanently delete project` gombot.
2. Olvasd el a `Permanently delete project` megerősítést és a következményeket.
3. Ha bizonytalan vagy, válaszd a `Cancel` gombot; semmi nem változik.
4. Ha biztos vagy benne, válaszd a párbeszédablak `Permanently delete project` gombját.

Siker esetén visszakerülsz a projektlistára, és a projekt többé nem érhető el. Ütközés esetén a projekt teljes egészében megmarad, hibaüzenet jelenik meg, és nem történt részleges törlés. Ilyenkor ne próbáld a megőrzött adatokat eltávolítani a törlés kedvéért; válaszd az archiválást.

## Hibahelyzetek és biztonságos folytatás

A Project Maker gyorsan jelez, ha egy kérés nem hajtható végre. A hibaüzenet nem jelenti automatikusan azt, hogy minden helyi adat elveszett, és a sikerüzenet sem helyettesíti a látható eredmény ellenőrzését.

### Általános helyreállítási sorrend

1. Állj meg, és olvasd el a teljes hibaüzenetet.
2. Ellenőrizd, látszik-e helyi piszkozat vagy korábbi mentett állapot.
3. Ne indíts ugyanabból a műveletből több párhuzamos példányt.
4. Ha mentés folyik, várd meg. Ha betöltési hiba van, használd az oldal saját újratöltési műveletét.
5. Ütközésnél töltsd újra az oldalt, és hasonlítsd össze a legfrissebb állapotot a szándékoddal.
6. Külső e-mail-hibánál ne kattints ismét automatikusan. Ellenőrizd a feladót, a címzettet, a felmérési összefoglaló vagy ügyfél-emlékeztető küldési előnézetét és a látható kézbesítési állapotot. Bizonytalan eredménynél a kimenő postafiókot is ellenőrizd, és csak a felület külön kockázatelfogadó műveletével próbáld újra.
7. Ismétlődő elérhetőségi vagy szolgáltatási hibát a projekt nevével, az oldal nevével, az időponttal és a látható hibaszöveggel jelezz az üzemeltetőnek. Titkot vagy teljes ügyféladatot ne másolj hibajegybe.

### Hiba- és helyreállítási mátrix

| Látható helyzet | Mi marad biztonságban? | Következő felhasználói lépés |
| --- | --- | --- |
| A webapp vagy a szolgáltatás nem elérhető | A korábban sikeresen mentett adat megmarad; a még nem mentett szöveges piszkozat csak az aktuális lapon lehet látható | Ne nyiss párhuzamos másolatot. Várj a kapcsolat helyreállására, majd az oldal saját újratöltési gombjával vagy frissítéssel ellenőrizd az állapotot |
| Portfolio Overview-, projektoldal-, felmérés-, kérdésbank- vagy specifikációbetöltési hiba | A betöltés nem módosít adatot | Válaszd az oldal nevével jelölt angol Reload műveletet. A közös projektfejlécből vagy visszalépő linkkel biztonságosan visszatérhetsz; ismételt hiba esetén jelezd az üzemeltetőnek |
| A projekt nem található | Más projekt nem változik | Térj vissza a `Portfolio Overview` oldalra. Ellenőrizd, hogy a projektet nem törölték-e, és a listából nyisd meg újra |
| A kiválasztott specifikációverzió nem található | A többi verzió és projektadat megmarad | Térj vissza a `Version history` részhez, és válassz létező verziót |
| `409` ütközés vagy elavult oldalállapot | A rendszer az egyik érvényes állapotot megőrizte; az elutasított kérés nem írta felül | Tisztázandó tétel szerkesztési ütközésénél ne ezt az általános oldal-újratöltést használd; lásd a következő sort. Más esetben töltsd újra az oldalt, olvasd el a friss állapotot, majd csak szükség esetén ismételd meg a módosítást |
| Tisztázandó tétel szerkesztési ütközése | A helyi szerkesztőpiszkozat és a legfrissebb lista megmarad; a régi verziós mentés nem ír felül adatot | Ne töltsd újra általánosan az oldalt, mert ez eldobná a megőrzött piszkozatot. Ha a frissítés sikertelen, válaszd a `Retry refresh` műveletet. Csak sikeres frissítés után válaszd nyitott tételnél a `Load current version` gombot, ellenőrizd az új értékeket, majd szükség esetén javítsd és mentsd újra; lezárt tételnél nincs újraszerkesztés vagy újratöltés, csak `Cancel` |
| Hibás vagy hiányzó űrlapmező | A korábban mentett állapot változatlan | Javítsd a megjelölt mezőt. Ne kerüld meg a validációt rövidebb, de félrevezető adattal |
| `Draft – awaiting automatic save` | A szöveg a böngészőlapon látható, de még nem szerveradat | Maradj az oldalon, és hagyj legalább 750 ms gépelési szünetet |
| `Saving…` | A legutóbbi mentett érték megmarad, az új kérés még bizonytalan | Ne zárd le a kört és ne navigálj el; várd meg a végállapotot |
| `Could not save…` egy felmérési válasznál | A sikertelen helyi piszkozat látható marad, a korábbi mentett válasz nem sérül | Ellenőrizd a piszkozatot, majd válaszd a `Retry save` gombot |
| A felmérés lezárása nem indítható | A kör nyitott, a mentett válaszok változatlanok | Várd meg a függő mentést vagy próbáld újra a hibás mentést; tartalmi hiány önmagában nem akadály |
| A felmérési összefoglaló előnézete elavult | Semmi nem ment ki | Töltsd újra az előnézetet a legutóbbi mentett válaszokból, majd erősítsd meg újra a küldést |
| A küldés eredménye bizonytalan | A kézbesítés és a duplikáció kockázata nem ismert | Ellenőrizd az üzemeltető szervezet dedikált kimenő postafiókját; csak ezután folytasd a felületen |
| Nincs elfogadott projektséma | Felmérési kör nem jön létre | Jelölj ki legalább egy aktív kérdést, majd válaszd a `Accept question schema and start Initial Intake` gombot |
| Nincs aktív alapkérdés | A korábbi bankverziók és projektek nem sérülnek | A kijelölt kérdésbank-gazda aktiváljon megfelelő kérdést, majd töltsd újra a `Initial Intake` oldalt |
| A séma zárolt | A nyitott kör pillanatképe változatlan marad | Fejezd be és zárd le a nyitott kört; az utódsémát csak utána publikáld |
| Már van nyitott kezdő kör | A meglévő kör és válaszai megmaradnak | Ne indíts újat. Töltsd újra a `Initial Intake` oldalt, és folytasd a visszatöltött aktív kört |
| A levélküldés nincs beállítva | Projekt, specifikációverzió és emlékeztető-állapot nem vész el; engedélyezési vagy küldési kérés sikertelen | Ne ismételd vakon. Kérd az üzemeltetőt a levélküldés ellenőrzésére |
| Az ügyfél-emlékeztető előnézete elavult | Nem ment ki levél, a helyi piszkozat megmaradt | Töltsd újra az aktuális piszkozatot, ellenőrizd a címzettet és a hivatkozást, majd készíts új előnézetet |
| Sikertelen e-mail-küldés | A projekt és a specifikációverzió megmarad; biztonságos hibakód rögzül | Ellenőrizd a címzettet és a szolgáltatás állapotát. Csak az ok tisztázása után ismételd meg a megfelelő küldést |
| Az e-mail gomb letiltott módosított emlékeztető-űrlap mellett | Semmi nem ment ki | Mentsd az emlékeztető beállítását, vagy állítsd vissza a mezőket a mentett értékre |
| Archivált projektben módosítás vagy küldés nem engedett | Minden megőrzött projektadat változatlan | Ha valóban újraindul a munka, a `Project Settings` oldalon állítsd vissza, rögzíts friss koordinációt, majd folytasd |
| A tisztázandó tétel már le van zárva | Az első végleges döntés megmarad | Töltsd újra a `Estimation Readiness` oldalt. Ne hozz létre második lezárást; szükséges új kérdésből készíts új tisztázandó tételt |
| Törlési konfliktus | A teljes projekt és minden kapcsolódó adat megmarad | Ne távolíts el történetet a törlés kedvéért; archiváld a projektet |

### Mikor ne próbáld újra ugyanazt azonnal?

Ne kattints újra automatikusan, ha:

- a művelet e-mailt küldhetett;
- a hiba ütközést jelez;
- a projektet másik munkatárs is módosíthatja;
- a képernyőn még `Saving…` látszik;
- a törlés eredménye nem egyértelmű;
- a kérdésbank verziója közben megváltozott.

Ezekben az esetekben előbb töltsd vissza a szerver által ismert állapotot vagy ellenőrizd az auditot, és csak utána dönts az ismétlésről.

## Fogalomtár és állapotreferencia

### Alapfogalmak

| Fogalom | Jelentés a Project Makerben |
| --- | --- |
| Projekt | Egy ügyféligény önálló felmérési és tisztázási munkatere, saját kapcsolattartóval és történettel |
| Portfolio Overview | Az aktív projektek és következő feladataik közös nézete |
| Project Status | A napi munkaközpont: kanonikus munkaállapot, elsődleges feladat, koordináció, ügyféllevelezés és legutóbbi aktivitás |
| Project Settings | A projekt adminisztratív felülete: alapadatok, ügyfélkapcsolati beállítások, adminisztratív projektfázis, archiválás és törlés |
| Belső projektgazda | A projektet vivő, név szerint rögzített belső munkatárs |
| Következő lépés felelőse | A belső projektgazda vagy az ügyfélkapcsolattartó; a felület mindig a kiválasztott konkrét nevet mutatja |
| Következő lépés | Az egyetlen konkrét művelet, amely a projektet a következő állapot felé viszi |
| Közös kérdésbank | Verziózott szervezeti kérdéskészlet, amelyből a projektsémák készülnek |
| Kérdésazonosító | Egy alapkérdés változatlan, verziókon átívelő azonosítója |
| Projektséma | Az adott projekthez kiválasztott aktív kérdések közzétett, verziózott készlete |
| Felmérési kör | A projektsémáról készített változatlan kérdéspillanatkép és a hozzá mentett válaszok |
| Tisztázandó tétel | Külön számon tartott tisztázandó pont felelőssel, dátummal, következő lépéssel és végleges döntéssel |
| Ügyfél-emlékeztető | E-mail-emlékeztetők automatikus ütemezése és kézi küldési állapota; nem tisztázási munkaelemlista |
| Specifikációverzió | Változatlan, verziózott projekt- és felmérési pillanatkép előnézettel és Markdown-letöltéssel |
| Fejlesztési csomag | Egy pontos specifikációverzióhoz kötött, közösen szerkesztett fejlesztési tételcsomag |
| Git setup | A telepítés minden belső felhasználója által kezelhető közös remote-, branch- és credential-beállítás |
| Claude Code-kapcsolat | A saját Claude Code és a Project Maker közötti, belső felhasználót azonosító MCP-kapcsolat; nem modell API |

### Adminisztratív projektfázisok röviden

| Státusz | Rövid jelentés | Tipikus következő ellenőrzés |
| --- | --- | --- |
| `In preparation` | Előkészítés | Van-e felelős és következő lépés? |
| `Discovery in progress` | Aktív igényfelmérés | Minden szöveges válasz `Saved`? |
| `Awaiting internal alignment` | Belső válaszra vagy döntésre vár | Van-e megnevezett belső projektgazda és dátum? |
| `Awaiting Customer feedback` | Ügyfélválaszra vár | Helyes-e a címzett, és kell-e emlékeztető? |
| `Handed over for planning` | Kézzel tervezésre átadottnak jelölt | Ellenőrizték-e a legfrissebb specifikációverziót? |
| `Archived` | Aktív munka lezárva | Új tartalom előtt visszaállították-e a projektet? |

### Egyéb állapotok

| Terület | Állapot | Jelentés |
| --- | --- | --- |
| Felmérési kör | `In progress` | Válaszolható és később folytatható |
| Felmérési kör | `Interview round completed` | A felmérés véget ért; csak aktív felmérési összefoglaló piszkozata mellett szerkeszthető |
| Felmérési összefoglaló | `Draft` | Aktív, szerkeszthető verzió |
| Felmérési összefoglaló | `Sending` | Küldési kísérlet folyamatban |
| Felmérési összefoglaló | `Accepted by mail gateway` | Elküldött, változatlan verzió |
| Felmérési összefoglaló | `Failed` | Ismert hiba után újrapróbálható |
| Felmérési összefoglaló | `Verification required` | Kézi kézbesítési ellenőrzést igényel |
| Tisztázandó tétel | `Open` | Döntésre vagy válaszra vár |
| Tisztázandó tétel | `Answered` | Végleges, érdemi válasz rögzítve |
| Tisztázandó tétel | `Not applicable` | Végleges, az elvetés indoka rögzítve |
| Emlékeztető kézbesítése | `No delivery attempts yet` | Még nem volt kísérlet |
| Emlékeztető kézbesítése | `Accepted by the mail system` | A legutóbbi küldési kísérlet sikeres |
| Emlékeztető kézbesítése | `Delivery failed` | A legutóbbi küldési kísérlet sikertelen |
| Markdown létrehozásának oka | `Manual generation` | Felhasználó által kezdeményezett pillanatkép |
| Markdown létrehozásának oka | `Milestone reached` | Névvel ellátott mérföldkő-pillanatkép |

## Mit nem tud még a jelenlegi verzió?

Az alábbiak nem elrejtett funkciók és nem más menüpontban találhatók; a jelenlegi kiadásban még nem elérhetők. A lista segít, hogy a kézikönyvben leírt működésből ne következtess többre a tényleges képességeknél.

### Hozzáférés és együttműködés

- Nincs szerepkör, projektjogosultság, tagság vagy külön admin: minden aktív belső felhasználó ugyanazokat a képességeket kapja.
- Nincs SSO vagy szervezeti felhasználó-provisioning; a VPN-en belüli dolgozók saját e-mail/jelszó fiókot kezelnek.
- Nincs kiforrott többfelhasználós konfliktuskezelés vagy közös szerkesztési jelenlétjelzés.
- Nincs projektkeresés, szűrés, csoportos művelet vagy külön archivált nézet.

### Projekt- és felmérési munka

- A projekt neve, a belső projektgazda és az ügyfélkapcsolati adatok minden aktív projektben szerkeszthetők; archiválva visszaállításig csak olvashatók.
- Csak kezdő felmérési kör indítható; további körtípus nincs.
- A jelenlegi felület az aktuális kezdő felméréshez tartozó felmérési összefoglaló verzióit mutatja; több külön történeti felmérési kör összevont böngészője nincs.
- A felkészültségi sáv nem állít át adminisztratív projektfázist, és nem helyettesíti a csapat üzleti döntését.
- A `Missing response blocks progress` és `Required` jelölés a felkészültség és a döntéstámogatás része; a felmérés technikai lezárását egyik sem akadályozza.
- A döntési pontszám és a becslési ajánlás döntéstámogatás, nem formális Go/Conditional Go/No-Go döntés és nem automatikusan generált kimenet.

### Tisztázás és kommunikáció

- Tisztázandó tétel újranyitása és törlése nem elérhető. Forráskapcsolat a `Estimation Readiness` oldalon, nyitott tételhez kezelhető.
- Nincs automatikus lejártság-kiemelés a projekten belüli tisztázási listában; a közös `Discovery Follow-ups` oldal határidő szerint rendez.
- A felmérési összefoglaló a projekt ügyfélkapcsolattartójának küldhető, előnézettel és megerősítéssel; nincs címzett-felülírás, olvasási visszaigazolás vagy szabad levélsablon-szerkesztő.
- A levélküldés nem rendelkezik felhasználói outboxszal vagy ismételt küldést láthatóan deduplikáló kezelőfelülettel.

### Dokumentumok és intelligens funkciók

- A Markdown nem tartalmaz tisztázandó tételt vagy ügyfél-emlékeztető állapotot.
- A Project Maker maga nem generál modellel user story-t vagy acceptance criteria-t; ezek kézzel vagy a saját Claude Code MCP-kapcsolaton keresztül kerülhetnek a fejlesztési csomagba.
- Nincs natív `.xlsx` export; a fejlesztési csomag CSV-ként és nyomtatási/PDF nézetben érhető el.
- Nincs telepíthető PWA vagy offline működés; a mentéshez hálózati kapcsolat kell.
- Nincs beágyazott live AI vagy provider API. A magyar útmutatás továbbra is verziózott és determinisztikus; a Claude Code a felhasználó saját előfizetésével, MCP-n dolgozik.
- Nincs szabadon szerkeszthető playbook-készítő; csak a csomagolt, verziózott playbookok választhatók.

### Adminisztratív projektfázis és megőrzés

- Az adminisztratív projektfázisok közötti sorrend nincs kikényszerítve és nincs automatikusan számítva.
- A visszaállítás az archiválás előtti teljes mentett munkafolyamat-állapotot folytatja, de nem állít vissza be nem mentett böngészőűrlapot vagy lejárt előnézetet, és nem ismétel meg külső műveletet.
- Az archivált projekt munkafelületei csak olvashatók; új tartalom előtt mindig állítsd vissza a projektet.
- Nincs specifikációverzió- vagy audit-esemény szerkesztés és törlés.
- A végfelhasználói felület nem biztosít platformszintű biztonsági mentési vagy visszaállítási műveletet.

## Napi és átadási ellenőrzőlisták

### Munkanap elején

- [ ] A helyes projektet nyitottam meg a `Portfolio Overview` oldalról.
- [ ] Az adminisztratív projektfázis megfelel a valós helyzetnek.
- [ ] A belső projektgazda konkrét személy, és a következő feladat gazdája a helyes megnevezett fél.
- [ ] A `Next action` konkrét és még aktuális.
- [ ] A `Due date` reális, és az időzóna minden érintett számára egyértelmű.
- [ ] A legkorábbi tisztázási határidőket átnéztem.
- [ ] Nincs előző napról megmaradt sikertelen emlékeztető vagy mentési hiba.

### Ügyfélnek küldés előtt

- [ ] A projekt nem archivált.
- [ ] A `Project Settings` oldalon szereplő kapcsolattartói név és e-mail-cím helyes.
- [ ] Az emlékeztető-beállítási űrlapon nincs nem mentett módosítás.
- [ ] Ügyfél-emlékeztető esetén a mentett piszkozat és a küldési előnézet aktuális.
- [ ] A legfrissebb specifikációverzió `Content preview` részét végigolvastam.
- [ ] Tudom, hogy felmérési összefoglalót vagy rövid emlékeztetőt küldök; a Claude Markdown egyik levélbe sem kerül.
- [ ] Küldés után ellenőriztem a sikerüzenetet és a kézbesítési kísérlet látható állapotát.

### Belső vagy ügyfél-átadás előtt

- [ ] Nincs függő vagy hibás felmérési mentés, és a felmérés lezárt.
- [ ] A felmérési összefoglaló címzettjét és legfrissebb előnézetét ellenőriztem; módosítás esetén új verzió készült.
- [ ] A blokkoló kérdések üzletileg is megválaszoltak, nem csak technikailag kitöltöttek.
- [ ] Minden fennmaradó bizonytalanságnak van külön tisztázandó tétele.
- [ ] Minden tisztázandó tételhez tartozik felelős, valódi dátum és következő lépés.
- [ ] A lezárt tisztázandó tételek döntésszövege önmagában érthető.
- [ ] Friss specifikációverzió készült, és a változásösszefoglaló mellett a teljes előnézetet is ellenőriztem.
- [ ] Az átvevő tudja, hogy a Markdown nem tartalmazza a tisztázási és ügyfél-emlékeztető állapotot.
- [ ] A `Project Status` legutóbbi aktivitásai és a munkafelületek mentett állapotai összhangban vannak.

### Az aktív munka végén

- [ ] Nincs `Draft`, `Saving…` vagy mentési hiba.
- [ ] A projektkoordináció és az adminisztratív projektfázis legutolsó változata mentve van.
- [ ] Nincs gazdátlan vagy dátum nélküli nyitott tisztázás.
- [ ] Az automatikus emlékeztetőt kikapcsoltam, ha nincs rá többé szükség.
- [ ] Szükség esetén záró specifikációverzió készült.
- [ ] Hasznos történet esetén archiválást választottam törlés helyett.
- [ ] Archiválás után ellenőriztem az `Archived` állapotot és a csak olvasható projektfelületeket.

Ha a fenti ellenőrzőlisták teljesülnek, a következő munkatárs a `Project Status`, az `Estimation Readiness`, a `Customer correspondence`, a `Project Settings` és a `Version history` alapján ugyanazt a projektállapotot tudja rekonstruálni, amelyből te befejezted a munkát.
