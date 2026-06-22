import type { ChecklistTemplateItem } from "./types";

export const checklistTemplate: ChecklistTemplateItem[] = [
  {
    id: 1,
    category: "Üzleti cél",
    controlPoint: "A projekt üzleti problémája és célja tisztázott.",
    exampleQuestion:
      "Milyen üzleti problémát akarunk megszüntetni? Mi történik, ha ezt nem fejlesztjük le?",
    hint:
      "A cél nem funkciólista, hanem üzleti eredmény: időmegtakarítás, kockázatcsökkentés, bevétel vagy megfelelőség.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 2,
    category: "Sikerkritérium",
    controlPoint: "Látható, mérhető sikerfeltételek vannak.",
    exampleQuestion:
      "Milyen mérhető eredményt vártok? Mikor mondja az üzleti oldal, hogy ez megérte?",
    hint:
      "Legyen mérhető vagy legalább egyértelműen validálható: kevesebb manuális munka, rövidebb átfutás, kevesebb hiba.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 3,
    category: "Stakeholderek",
    controlPoint: "Az üzleti döntéshozók és érintettek azonosítva vannak.",
    exampleQuestion:
      "Ki dönt scope-ról, prioritásról, elfogadásról és élesítésről?",
    hint:
      "A döntési szerepek tisztázása védi a scope-ot és gyorsítja a későbbi elfogadást.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 4,
    category: "Felhasználók",
    controlPoint: "A fő felhasználói csoportok és szerepkörök ismertek.",
    exampleQuestion:
      "Kik fogják használni a rendszert? Ki mit láthat, módosíthat vagy jóváhagyhat?",
    hint:
      "Felhasználói csoportok, jogosultsági szintek, belső/külső szereplők és admin szerep.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 5,
    category: "Jelenlegi folyamat",
    controlPoint: "A jelenlegi működés és fájdalompontok le vannak írva.",
    exampleQuestion:
      "Most hogyan csináljátok ezt? Excelben, e-mailben vagy más rendszerben történik?",
    hint:
      "Érdemes rögzíteni a kerülőutakat, manuális egyeztetéseket és tipikus fájdalompontokat.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 6,
    category: "Célfolyamat",
    controlPoint: "A kívánt jövőbeli működés magas szinten ismert.",
    exampleQuestion:
      "Mi lenne az ideális működés? Melyik lépés legyen automatizált, és mi marad manuális?",
    hint:
      "Rögzítsd, hol lesz döntési pont, jóváhagyás, automatizmus vagy kézi kontroll.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 7,
    category: "MVP scope",
    controlPoint: "Az első működőképes verzió tartalma elkülönül.",
    exampleQuestion:
      "Mi az, ami nélkül nem indulhat élesben? Ha csak 3 dolgot fejleszthetünk, mik azok?",
    hint:
      "A valódi MVP kontrollált induló csomag, nem kompromisszum nélküli végállapot.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 8,
    category: "Out of scope",
    controlPoint: "A tudatosan kizárt elemek is rögzítve vannak.",
    exampleQuestion:
      "Mi az, amit kifejezetten nem akarunk az MVP-ben? Mi tehető későbbi fázisba?",
    hint:
      "A nem-scope legalább olyan fontos, mint a scope: védi a becslést és a delivery fókuszt.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 9,
    category: "Funkcionális igények",
    controlPoint: "A fő funkciók és user flow-k megfogalmazhatók.",
    exampleQuestion: "Milyen műveleteket kell tudnia a felhasználónak elvégezni?",
    hint:
      "Képernyők, műveletek, státuszok, workflow, validációk és értesítések.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 10,
    category: "User flow",
    controlPoint: "Legalább a fő végponttól végpontig tartó folyamat ismert.",
    exampleQuestion:
      "Ki indítja a folyamatot, milyen adatot ad meg, mi történik utána, hol ér véget?",
    hint:
      "Minimum a kritikus folyamatok: létrehozás, módosítás, jóváhagyás, lezárás, riportálás.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 11,
    category: "Adatok",
    controlPoint: "A fő adatok, adatmezők és adatforrások azonosítva vannak.",
    exampleQuestion:
      "Milyen adatmezők szükségesek? Van meglévő adatforrás vagy migrációs igény?",
    hint:
      "Kötelező mezők, törzsadatok, adatminőség, migráció és historikus adat.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 12,
    category: "Adatminőség",
    controlPoint: "Az adatminőségi kockázatok láthatók.",
    exampleQuestion:
      "Mennyire megbízható a meglévő adat? Van duplikáció, hiányzó mező vagy manuális javítás?",
    hint:
      "A gyenge adatminőség becslési és delivery kockázat, még akkor is, ha nem MVP-funkció.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 13,
    category: "Integrációk",
    controlPoint: "A szükséges rendszerek és kapcsolódási irányok ismertek.",
    exampleQuestion:
      "Milyen külső vagy belső rendszerekkel kell összekötni? API, import, export vagy adatbázis kapcsolat kell?",
    hint:
      "Rendszer, irány, technológia, adatgazda és kerülőút is számít.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 14,
    category: "Integrációs működés",
    controlPoint: "A kapcsolat típusa és gyakorisága ismert.",
    exampleQuestion:
      "Valós idejű adatkapcsolat kell, vagy elég batch / napi / manuális import?",
    hint:
      "A real-time és a batch működés becslése nagyon eltérhet.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 15,
    category: "Jogosultságok",
    controlPoint: "A szerepkörök és hozzáférési szintek vázlatosan megvannak.",
    exampleQuestion:
      "Van admin, jóváhagyó, olvasó, szerkesztő szerepkör? Ki mit tehet?",
    hint:
      "Szerepkör mátrix nélkül később szinte biztosan újranyílik a scope.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 16,
    category: "Üzleti szabályok",
    controlPoint: "A döntési, számítási és státuszváltási logikák ismertek.",
    exampleQuestion:
      "Milyen feltételek alapján történik jóváhagyás, számítás vagy státuszváltás?",
    hint:
      "Jóváhagyási logika, státuszváltás, küszöbérték, kivétel és automatikus döntés.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 17,
    category: "Kivételek",
    controlPoint: "A kivételes esetek és határhelyzetek legalább listázva vannak.",
    exampleQuestion:
      "Van limit, kivétel, határérték, manuális felülbírálás vagy speciális ügy?",
    hint:
      "A kivételek gyakran rejtett scope-ot és tesztelési igényt jelentenek.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 18,
    category: "Nem funkcionális igények",
    controlPoint:
      "A minimális teljesítmény, biztonság és rendelkezésre állási elvárás ismert.",
    exampleQuestion:
      "Hány felhasználó használja egyszerre? Van válaszidő, audit, naplózás, GDPR vagy biztonsági elvárás?",
    hint:
      "Biztonság, audit, teljesítmény, rendelkezésre állás, GDPR és üzletmenet-folytonosság.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 19,
    category: "Riportok",
    controlPoint: "A szükséges riportok, exportok és dashboardok azonosítva vannak.",
    exampleQuestion:
      "Milyen riportokat kell előállítani? Kinek, milyen bontásban és milyen gyakorisággal?",
    hint:
      "Excel, PDF, dashboard, vezetői nézet, operatív lista és rendszeres küldés.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: false
  },
  {
    id: 20,
    category: "UX / felület",
    controlPoint: "A fő felületi elvárások és eszközhasználat tisztázott.",
    exampleQuestion: "Van minta, amit követni kell? Mobilon is használják, vagy csak desktopon?",
    hint:
      "A rossz UX később support- és adoption-költségként jön vissza.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: false
  },
  {
    id: 21,
    category: "Prioritás",
    controlPoint: "Az igények priorizálhatók.",
    exampleQuestion:
      "Mi kritikus, mi fontos, és mi halasztható? Mi az első fejlesztési szelet?",
    hint:
      "A priorizálás mutatja meg, mi fér bele az első szállításba és mi későbbi fázis.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 22,
    category: "Határidő",
    controlPoint: "A fix üzleti, jogszabályi vagy szerződéses határidők ismertek.",
    exampleQuestion:
      "Van fix dátum, jogszabályi határidő, szerződéses vállalás vagy kampányindulás?",
    hint:
      "Tisztázni kell: fix scope, fix idő vagy fix budget a kemény korlát.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 23,
    category: "Keret / budget",
    controlPoint: "Az idő, scope és költség korlátja tisztázott.",
    exampleQuestion:
      "Fix scope, fix idő vagy fix budget a fontosabb? Van előzetes költségkeret?",
    hint:
      "A becslés értelmezése más lesz fix idő, fix scope vagy fix keret mellett.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 24,
    category: "Függőségek",
    controlPoint: "A külső és belső függőségek azonosítva vannak.",
    exampleQuestion:
      "Van külső szállító, API, adatgazda, infrastruktúra vagy döntéshozó, akitől függünk?",
    hint:
      "Külső szállító, API, adatgazda, infrastruktúra, döntéshozó vagy beszerzés.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 25,
    category: "Kockázatok",
    controlPoint: "A fő üzleti, technikai és adat oldali kockázatok láthatók.",
    exampleQuestion: "Mitől tartotok leginkább? Hol van a legtöbb bizonytalanság?",
    hint:
      "Üzleti, technológiai, adat-, integrációs, kapacitás-, compliance- vagy döntési kockázat.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 26,
    category: "Elfogadási kritériumok",
    controlPoint: "Legalább az MVP funkciók elfogadási logikája ismert.",
    exampleQuestion:
      "Milyen feltételekkel fogadjátok el? Mit kell demonstrálni review-n?",
    hint:
      "Tesztelhető, demonstrálható, egyértelmű feltételek. Nem érzésre kész.",
    requiredForMvp: true,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 27,
    category: "Tesztelés",
    controlPoint: "A tesztelés felelőse és minimum lefedettsége tisztázott.",
    exampleQuestion: "Ki tesztel? Milyen tesztesetek kötelezők élesítés előtt?",
    hint:
      "Rögzítsd a minimum tesztelési felelősséget, teszteseteket és elfogadási szerepeket.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 28,
    category: "Élesítés",
    controlPoint: "Az élesítés feltételei és kockázatai ismertek.",
    exampleQuestion:
      "Mikor és hogyan élesíthető? Kell adatbetöltés, oktatás, fallback vagy kommunikáció?",
    hint:
      "Élesítésnél számít az adatbetöltés, oktatás, fallback, kommunikáció és release ablak.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 29,
    category: "Üzemeltetés",
    controlPoint: "Az élesítés utáni működtetés és support felelősei megvannak.",
    exampleQuestion:
      "Ki lesz a rendszer gazdája? Ki kezeli a hibákat, jogosultságokat és konfigurációt?",
    hint:
      "Support modell, SLA, adminisztráció, konfiguráció és release utáni felelősség.",
    requiredForMvp: false,
    requiredForEstimate: true,
    blockingIfMissing: true
  },
  {
    id: 30,
    category: "Dokumentáció",
    controlPoint:
      "A szükséges projekt-, üzleti és technikai dokumentáció típusa ismert.",
    exampleQuestion:
      "Milyen dokumentáció kell a PM, üzlet, fejlesztés, support vagy audit számára?",
    hint:
      "PM, üzleti, fejlesztői, support és audit dokumentáció eltérő részletezettséget igényelhet.",
    requiredForMvp: false,
    requiredForEstimate: false,
    blockingIfMissing: false
  }
];

export const projectStatuses = [
  "Előkészítés",
  "Becslés alatt",
  "Fejlesztésre kész",
  "Blokkolt"
] as const;

export const priorities = ["Kiemelt", "Fontos", "Alap", "Alacsony"] as const;

export const checklistStatuses = [
  "Nincs meg",
  "Részben megvan",
  "Kész",
  "Nem releváns"
] as const;

export const followUpStatuses = [
  "Nyitott",
  "Folyamatban",
  "Megválaszolva",
  "Blokkolt",
  "Nem releváns"
] as const;

export const decisions = ["", "Go", "Feltételes Go", "No-Go"] as const;
