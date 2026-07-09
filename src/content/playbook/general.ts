import type { Playbook } from "./types";

/**
 * The "Általános" (General) playbook — Phase 2's only playbook (D-01). Its
 * `items` are a 1:1 content copy of the legacy `checklistTemplate`
 * (src/data/checklist.ts), deliberately DROPPING the legacy tip/coaching
 * field (D-11 — coaching content moves to `content/coaching/*` in 02-04).
 * Its `weights` are the legacy hardcoded values from `src/lib/project.ts`
 * (`calculateReadinessPercent` and `calculateDecisionScore`).
 */
export const general: Playbook = {
  id: "general",
  name: "Általános",
  version: 1,
  items: [
    {
      id: 1,
      category: "Üzleti cél",
      controlPoint: "A projekt üzleti problémája és célja tisztázott.",
      exampleQuestion:
        "Milyen üzleti problémát akarunk megszüntetni? Mi történik, ha ezt nem fejlesztjük le?",
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
      requiredForMvp: true,
      requiredForEstimate: true,
      blockingIfMissing: true
    },
    {
      id: 3,
      category: "Stakeholderek",
      controlPoint: "Az üzleti döntéshozók és érintettek azonosítva vannak.",
      exampleQuestion: "Ki dönt scope-ról, prioritásról, elfogadásról és élesítésről?",
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
      requiredForMvp: true,
      requiredForEstimate: true,
      blockingIfMissing: true
    },
    {
      id: 9,
      category: "Funkcionális igények",
      controlPoint: "A fő funkciók és user flow-k megfogalmazhatók.",
      exampleQuestion: "Milyen műveleteket kell tudnia a felhasználónak elvégezni?",
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
      requiredForMvp: false,
      requiredForEstimate: true,
      blockingIfMissing: true
    },
    {
      id: 15,
      category: "Jogosultságok",
      controlPoint: "A szerepkörök és hozzáférési szintek vázlatosan megvannak.",
      exampleQuestion: "Van admin, jóváhagyó, olvasó, szerkesztő szerepkör? Ki mit tehet?",
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
      requiredForMvp: false,
      requiredForEstimate: true,
      blockingIfMissing: false
    },
    {
      id: 20,
      category: "UX / felület",
      controlPoint: "A fő felületi elvárások és eszközhasználat tisztázott.",
      exampleQuestion: "Van minta, amit követni kell? Mobilon is használják, vagy csak desktopon?",
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
      requiredForMvp: true,
      requiredForEstimate: true,
      blockingIfMissing: true
    },
    {
      id: 25,
      category: "Kockázatok",
      controlPoint: "A fő üzleti, technikai és adat oldali kockázatok láthatók.",
      exampleQuestion: "Mitől tartotok leginkább? Hol van a legtöbb bizonytalanság?",
      requiredForMvp: true,
      requiredForEstimate: true,
      blockingIfMissing: true
    },
    {
      id: 26,
      category: "Elfogadási kritériumok",
      controlPoint: "Legalább az MVP funkciók elfogadási logikája ismert.",
      exampleQuestion: "Milyen feltételekkel fogadjátok el? Mit kell demonstrálni review-n?",
      requiredForMvp: true,
      requiredForEstimate: true,
      blockingIfMissing: true
    },
    {
      id: 27,
      category: "Tesztelés",
      controlPoint: "A tesztelés felelőse és minimum lefedettsége tisztázott.",
      exampleQuestion: "Ki tesztel? Milyen tesztesetek kötelezők élesítés előtt?",
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
      requiredForMvp: false,
      requiredForEstimate: false,
      blockingIfMissing: false
    }
  ],
  weights: {
    baseInfo: 0.2,
    business: 0.2,
    ownership: 0.15,
    checklist: 0.3,
    followUpResolution: 0.15,
    businessValue: 0.25,
    strategicAlignment: 0.15,
    urgency: 0.15,
    confidence: 0.15,
    complexity: 0.1,
    risk: 0.1,
    readiness: 0.1
  }
};
