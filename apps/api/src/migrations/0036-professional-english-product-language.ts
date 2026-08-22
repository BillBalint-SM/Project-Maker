import { randomUUID } from 'node:crypto';

import type { MigrationInterface, QueryRunner } from 'typeorm';

interface LocalizedField {
  readonly hu: string;
  readonly en: string;
}

interface CanonicalQuestionCopy {
  readonly topic: LocalizedField;
  readonly controlPoint: LocalizedField;
  readonly text: LocalizedField;
  readonly hint: LocalizedField;
}

interface StoredQuestion {
  readonly id: string;
  readonly stableKey: string;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
  readonly type: string;
  readonly required: boolean;
  readonly requiredForEstimate: boolean;
  readonly blocking: boolean;
  readonly order: number;
  readonly active: boolean;
  readonly hint: string | null;
  readonly options: unknown;
  readonly source: string;
}

const field = (hu: string, en: string): LocalizedField => ({ hu, en });

const generalQuestionCopy: readonly CanonicalQuestionCopy[] = [
  {
    topic: field('Üzleti cél', 'Business objective'),
    controlPoint: field('A projekt üzleti problémája és célja tisztázott.', 'The business problem and desired outcome are clearly defined.'),
    text: field('Milyen üzleti problémát akarunk megszüntetni? Mi történik, ha ezt nem fejlesztjük le?', 'What business problem are we solving, and what happens if we do not implement this solution?'),
    hint: field('A cél nem funkciólista, hanem üzleti eredmény: időmegtakarítás, kockázatcsökkentés, bevétel vagy megfelelőség.', 'Define a business outcome rather than a feature list, such as time saved, risk reduced, revenue generated, or compliance achieved.'),
  },
  {
    topic: field('Sikerkritérium', 'Success criteria'),
    controlPoint: field('Látható, mérhető sikerfeltételek vannak.', 'Measurable success criteria have been agreed.'),
    text: field('Milyen mérhető eredményt vártok? Mikor mondja az üzleti oldal, hogy ez megérte?', 'What measurable outcome is expected, and how will the business determine that the investment was worthwhile?'),
    hint: field('Legyen mérhető vagy legalább egyértelműen validálható: kevesebb manuális munka, rövidebb átfutás, kevesebb hiba.', 'Use measurable or objectively verifiable outcomes, such as less manual work, shorter lead time, or fewer errors.'),
  },
  {
    topic: field('Stakeholderek', 'Stakeholders'),
    controlPoint: field('Az üzleti döntéshozók és érintettek azonosítva vannak.', 'Business decision-makers and key stakeholders have been identified.'),
    text: field('Ki dönt scope-ról, prioritásról, elfogadásról és élesítésről?', 'Who makes decisions about scope, priority, acceptance, and production release?'),
    hint: field('A döntési szerepek tisztázása védi a scope-ot és gyorsítja a későbbi elfogadást.', 'Clear decision ownership protects the scope and accelerates acceptance.'),
  },
  {
    topic: field('Felhasználók', 'Users and roles'),
    controlPoint: field('A fő felhasználói csoportok és szerepkörök ismertek.', 'The main user groups and operational roles are understood.'),
    text: field('Kik fogják használni a rendszert? Ki mit láthat, módosíthat vagy jóváhagyhat?', 'Who will use the system, and what must each user group be able to view, change, or approve?'),
    hint: field('Felhasználói csoportok, jogosultsági szintek, belső/külső szereplők és admin szerep.', 'Capture user groups, access levels, internal and external actors, and any administrative responsibilities.'),
  },
  {
    topic: field('Jelenlegi folyamat', 'Current process'),
    controlPoint: field('A jelenlegi működés és fájdalompontok le vannak írva.', 'The current workflow and its pain points are documented.'),
    text: field('Most hogyan csináljátok ezt? Excelben, e-mailben vagy más rendszerben történik?', 'How is this work performed today? Does it rely on spreadsheets, email, or another system?'),
    hint: field('Érdemes rögzíteni a kerülőutakat, manuális egyeztetéseket és tipikus fájdalompontokat.', 'Record workarounds, manual coordination, handoffs, and recurring pain points.'),
  },
  {
    topic: field('Célfolyamat', 'Target process'),
    controlPoint: field('A kívánt jövőbeli működés magas szinten ismert.', 'The intended future-state workflow is understood at a high level.'),
    text: field('Mi lenne az ideális működés? Melyik lépés legyen automatizált, és mi marad manuális?', 'What should the target workflow look like? Which steps should be automated, and which should remain manual?'),
    hint: field('Rögzítsd, hol lesz döntési pont, jóváhagyás, automatizmus vagy kézi kontroll.', 'Identify decision points, approvals, automation, and required manual controls.'),
  },
  {
    topic: field('MVP scope', 'MVP scope'),
    controlPoint: field('Az első működőképes verzió tartalma elkülönül.', 'The scope of the first viable release is clearly separated from later work.'),
    text: field('Mi az, ami nélkül nem indulhat élesben? Ha csak 3 dolgot fejleszthetünk, mik azok?', 'What is essential for the first production release? If only three capabilities could be delivered, which would they be?'),
    hint: field('A valódi MVP kontrollált induló csomag, nem kompromisszum nélküli végállapot.', 'An MVP is a controlled initial release, not the complete end-state solution.'),
  },
  {
    topic: field('Out of scope', 'Out of scope'),
    controlPoint: field('A tudatosan kizárt elemek is rögzítve vannak.', 'Explicit exclusions from the current scope are documented.'),
    text: field('Mi az, amit kifejezetten nem akarunk az MVP-ben? Mi tehető későbbi fázisba?', 'What is explicitly excluded from the MVP, and what can be deferred to a later phase?'),
    hint: field('A nem-scope legalább olyan fontos, mint a scope: védi a becslést és a delivery fókuszt.', 'Out-of-scope decisions protect the estimate and keep delivery focused.'),
  },
  {
    topic: field('Funkcionális igények', 'Functional requirements'),
    controlPoint: field('A fő funkciók és user flow-k megfogalmazhatók.', 'The primary capabilities and user flows can be described.'),
    text: field('Milyen műveleteket kell tudnia a felhasználónak elvégezni?', 'What tasks must users be able to complete in the system?'),
    hint: field('Képernyők, műveletek, státuszok, workflow, validációk és értesítések.', 'Consider screens, actions, states, workflows, validation rules, and notifications.'),
  },
  {
    topic: field('User flow', 'End-to-end user flow'),
    controlPoint: field('Legalább a fő végponttól végpontig tartó folyamat ismert.', 'At least the primary end-to-end workflow is understood.'),
    text: field('Ki indítja a folyamatot, milyen adatot ad meg, mi történik utána, hol ér véget?', 'Who initiates the workflow, what information do they provide, what happens next, and how does the workflow end?'),
    hint: field('Minimum a kritikus folyamatok: létrehozás, módosítás, jóváhagyás, lezárás, riportálás.', 'Cover the critical paths at minimum: create, update, approve, close, and report.'),
  },
  {
    topic: field('Adatok', 'Data requirements'),
    controlPoint: field('A fő adatok, adatmezők és adatforrások azonosítva vannak.', 'Core data entities, fields, and sources have been identified.'),
    text: field('Milyen adatmezők szükségesek? Van meglévő adatforrás vagy migrációs igény?', 'Which data fields are required? Are there existing data sources or migration requirements?'),
    hint: field('Kötelező mezők, törzsadatok, adatminőség, migráció és historikus adat.', 'Consider required fields, master data, data quality, migration, and historical records.'),
  },
  {
    topic: field('Adatminőség', 'Data quality'),
    controlPoint: field('Az adatminőségi kockázatok láthatók.', 'Material data-quality risks are understood.'),
    text: field('Mennyire megbízható a meglévő adat? Van duplikáció, hiányzó mező vagy manuális javítás?', 'How reliable is the existing data? Are there duplicates, missing fields, or manual corrections?'),
    hint: field('A gyenge adatminőség becslési és delivery kockázat, még akkor is, ha nem MVP-funkció.', 'Poor data quality is an estimation and delivery risk even when data remediation is not an MVP feature.'),
  },
  {
    topic: field('Integrációk', 'Integrations'),
    controlPoint: field('A szükséges rendszerek és kapcsolódási irányok ismertek.', 'Required systems and integration directions have been identified.'),
    text: field('Milyen külső vagy belső rendszerekkel kell összekötni? API, import, export vagy adatbázis kapcsolat kell?', 'Which internal or external systems must be integrated? Is an API, import, export, or database connection required?'),
    hint: field('Rendszer, irány, technológia, adatgazda és kerülőút is számít.', 'Capture each system, data-flow direction, technology, data owner, and fallback option.'),
  },
  {
    topic: field('Integrációs működés', 'Integration operating model'),
    controlPoint: field('A kapcsolat típusa és gyakorisága ismert.', 'The integration pattern and execution frequency are understood.'),
    text: field('Valós idejű adatkapcsolat kell, vagy elég batch / napi / manuális import?', 'Is real-time integration required, or is a scheduled batch or manual import sufficient?'),
    hint: field('A real-time és a batch működés becslése nagyon eltérhet.', 'Real-time and batch integration can have materially different delivery estimates.'),
  },
  {
    topic: field('Jogosultságok', 'Access control'),
    controlPoint: field('A szerepkörök és hozzáférési szintek vázlatosan megvannak.', 'Required roles and access levels are outlined.'),
    text: field('Van admin, jóváhagyó, olvasó, szerkesztő szerepkör? Ki mit tehet?', 'Which administrative, approval, read, or edit capabilities are required, and who needs each one?'),
    hint: field('Szerepkör mátrix nélkül később szinte biztosan újranyílik a scope.', 'Without an access matrix, scope is likely to reopen later in delivery.'),
  },
  {
    topic: field('Üzleti szabályok', 'Business rules'),
    controlPoint: field('A döntési, számítási és státuszváltási logikák ismertek.', 'Decision, calculation, and state-transition rules are understood.'),
    text: field('Milyen feltételek alapján történik jóváhagyás, számítás vagy státuszváltás?', 'Which conditions govern approvals, calculations, or state transitions?'),
    hint: field('Jóváhagyási logika, státuszváltás, küszöbérték, kivétel és automatikus döntés.', 'Capture approval logic, state transitions, thresholds, exceptions, and automated decisions.'),
  },
  {
    topic: field('Kivételek', 'Exceptions and edge cases'),
    controlPoint: field('A kivételes esetek és határhelyzetek legalább listázva vannak.', 'Known exceptions and edge cases are listed.'),
    text: field('Van limit, kivétel, határérték, manuális felülbírálás vagy speciális ügy?', 'Are there limits, exceptions, thresholds, manual overrides, or special cases?'),
    hint: field('A kivételek gyakran rejtett scope-ot és tesztelési igényt jelentenek.', 'Exceptions often reveal hidden scope and additional testing needs.'),
  },
  {
    topic: field('Nem funkcionális igények', 'Non-functional requirements'),
    controlPoint: field('A minimális teljesítmény, biztonság és rendelkezésre állási elvárás ismert.', 'Minimum performance, security, and availability requirements are understood.'),
    text: field('Hány felhasználó használja egyszerre? Van válaszidő, audit, naplózás, GDPR vagy biztonsági elvárás?', 'How many users will use the system concurrently? Are there response-time, audit, logging, privacy, or security requirements?'),
    hint: field('Biztonság, audit, teljesítmény, rendelkezésre állás, GDPR és üzletmenet-folytonosság.', 'Consider security, auditability, performance, availability, privacy, and business continuity.'),
  },
  {
    topic: field('Riportok', 'Reporting and analytics'),
    controlPoint: field('A szükséges riportok, exportok és dashboardok azonosítva vannak.', 'Required reports, exports, and dashboards have been identified.'),
    text: field('Milyen riportokat kell előállítani? Kinek, milyen bontásban és milyen gyakorisággal?', 'Which reports are required, for whom, at what level of detail, and how frequently?'),
    hint: field('Excel, PDF, dashboard, vezetői nézet, operatív lista és rendszeres küldés.', 'Consider spreadsheet and PDF exports, dashboards, executive views, operational lists, and scheduled distribution.'),
  },
  {
    topic: field('UX / felület', 'User experience and interface'),
    controlPoint: field('A fő felületi elvárások és eszközhasználat tisztázott.', 'Key interface expectations and target devices are understood.'),
    text: field('Van minta, amit követni kell? Mobilon is használják, vagy csak desktopon?', 'Is there an existing design standard to follow? Must the solution support mobile devices, or desktop only?'),
    hint: field('A rossz UX később support- és adoption-költségként jön vissza.', 'Poor user experience creates downstream support costs and reduces adoption.'),
  },
  {
    topic: field('Prioritás', 'Prioritization'),
    controlPoint: field('Az igények priorizálhatók.', 'Requirements can be ordered by delivery priority.'),
    text: field('Mi kritikus, mi fontos, és mi halasztható? Mi az első fejlesztési szelet?', 'What is critical, what is important, and what can be deferred? What should the first delivery slice contain?'),
    hint: field('A priorizálás mutatja meg, mi fér bele az első szállításba és mi későbbi fázis.', 'Prioritization determines what belongs in the first release and what moves to a later phase.'),
  },
  {
    topic: field('Határidő', 'Deadlines and milestones'),
    controlPoint: field('A fix üzleti, jogszabályi vagy szerződéses határidők ismertek.', 'Fixed business, regulatory, or contractual deadlines are known.'),
    text: field('Van fix dátum, jogszabályi határidő, szerződéses vállalás vagy kampányindulás?', 'Is there a fixed date, regulatory deadline, contractual commitment, or campaign launch?'),
    hint: field('Tisztázni kell: fix scope, fix idő vagy fix budget a kemény korlát.', 'Identify whether scope, time, or budget is the governing constraint.'),
  },
  {
    topic: field('Keret / budget', 'Budget and constraints'),
    controlPoint: field('Az idő, scope és költség korlátja tisztázott.', 'Time, scope, and cost constraints are understood.'),
    text: field('Fix scope, fix idő vagy fix budget a fontosabb? Van előzetes költségkeret?', 'Which constraint takes precedence: fixed scope, fixed timeline, or fixed budget? Is an initial budget range available?'),
    hint: field('A becslés értelmezése más lesz fix idő, fix scope vagy fix keret mellett.', 'An estimate must be interpreted differently under fixed-time, fixed-scope, and fixed-budget constraints.'),
  },
  {
    topic: field('Függőségek', 'Dependencies'),
    controlPoint: field('A külső és belső függőségek azonosítva vannak.', 'Internal and external dependencies have been identified.'),
    text: field('Van külső szállító, API, adatgazda, infrastruktúra vagy döntéshozó, akitől függünk?', 'Does delivery depend on an external vendor, API, data owner, infrastructure team, or decision-maker?'),
    hint: field('Külső szállító, API, adatgazda, infrastruktúra, döntéshozó vagy beszerzés.', 'Consider vendors, APIs, data owners, infrastructure, decision-makers, and procurement.'),
  },
  {
    topic: field('Kockázatok', 'Risks and uncertainties'),
    controlPoint: field('A fő üzleti, technikai és adat oldali kockázatok láthatók.', 'Key business, technical, and data risks are visible.'),
    text: field('Mitől tartotok leginkább? Hol van a legtöbb bizonytalanság?', 'What are the greatest concerns, and where is uncertainty highest?'),
    hint: field('Üzleti, technológiai, adat-, integrációs, kapacitás-, compliance- vagy döntési kockázat.', 'Consider business, technology, data, integration, capacity, compliance, and decision risks.'),
  },
  {
    topic: field('Elfogadási kritériumok', 'Acceptance criteria'),
    controlPoint: field('Legalább az MVP funkciók elfogadási logikája ismert.', 'Acceptance conditions are defined for at least the MVP capabilities.'),
    text: field('Milyen feltételekkel fogadjátok el? Mit kell demonstrálni review-n?', 'Under which conditions will the solution be accepted, and what must be demonstrated during review?'),
    hint: field('Tesztelhető, demonstrálható, egyértelmű feltételek. Nem érzésre kész.', 'Use unambiguous, testable, and demonstrable conditions instead of subjective completion criteria.'),
  },
  {
    topic: field('Tesztelés', 'Testing and quality assurance'),
    controlPoint: field('A tesztelés felelőse és minimum lefedettsége tisztázott.', 'Testing ownership and the minimum required coverage are clear.'),
    text: field('Ki tesztel? Milyen tesztesetek kötelezők élesítés előtt?', 'Who is responsible for testing, and which scenarios must pass before production release?'),
    hint: field('Rögzítsd a minimum tesztelési felelősséget, teszteseteket és elfogadási szerepeket.', 'Define minimum testing responsibilities, required scenarios, and acceptance roles.'),
  },
  {
    topic: field('Élesítés', 'Release and rollout'),
    controlPoint: field('Az élesítés feltételei és kockázatai ismertek.', 'Production release conditions and rollout risks are understood.'),
    text: field('Mikor és hogyan élesíthető? Kell adatbetöltés, oktatás, fallback vagy kommunikáció?', 'When and how can the solution be released? Are data loading, training, rollback, or stakeholder communications required?'),
    hint: field('Élesítésnél számít az adatbetöltés, oktatás, fallback, kommunikáció és release ablak.', 'Consider data loading, training, rollback, communications, and the release window.'),
  },
  {
    topic: field('Üzemeltetés', 'Operations and support'),
    controlPoint: field('Az élesítés utáni működtetés és support felelősei megvannak.', 'Post-release ownership and support responsibilities are assigned.'),
    text: field('Ki lesz a rendszer gazdája? Ki kezeli a hibákat, jogosultságokat és konfigurációt?', 'Who will own the system after release? Who will manage incidents, access, and configuration?'),
    hint: field('Support modell, SLA, adminisztráció, konfiguráció és release utáni felelősség.', 'Define the support model, service levels, administration, configuration, and post-release ownership.'),
  },
  {
    topic: field('Dokumentáció', 'Documentation'),
    controlPoint: field('A szükséges projekt-, üzleti és technikai dokumentáció típusa ismert.', 'Required project, business, and technical documentation is understood.'),
    text: field('Milyen dokumentáció kell a PM, üzlet, fejlesztés, support vagy audit számára?', 'Which documentation is required for Project Management, business stakeholders, engineering, support, or audit?'),
    hint: field('PM, üzleti, fejlesztői, support és audit dokumentáció eltérő részletezettséget igényelhet.', 'Project Management, business, engineering, support, and audit documentation may require different levels of detail.'),
  },
] as const;

const defaultTemplateId = '00000000-0000-4000-8000-000000000013';
const originalTemplateName = 'Alapértelmezett projektterv';
const englishTemplateName = 'Default Project Specification';
const originalTemplateContent = `# Projekt specifikáció — {{project.name}}

{{revision.metadata}}

{{project.context}}

{{project.schema?}}

{{project.initialIntake?}}

{{project.readiness?}}

{{project.decisionReview?}}`;
const englishTemplateContent = `# Project Specification — {{project.name}}

{{revision.metadata}}

{{project.context}}

{{project.schema?}}

{{project.initialIntake?}}

{{project.readiness?}}

{{project.decisionReview?}}`;

export class ProfessionalEnglishProductLanguage0036ProfessionalEnglishProductLanguage1788940800000
  implements MigrationInterface
{
  name = 'ProfessionalEnglishProductLanguage0036ProfessionalEnglishProductLanguage1788940800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await publishEnglishQuestionBankSuccessor(queryRunner);
    await publishEnglishDefaultTemplateSuccessor(queryRunner);
  }

  async down(): Promise<void> {
    throw new Error(
      'Professional English product language is forward-only because published Question Bank and Markdown template versions are immutable.',
    );
  }
}

async function publishEnglishQuestionBankSuccessor(queryRunner: QueryRunner): Promise<void> {
  const versionRows = (await queryRunner.query(
    'SELECT MAX("bank_version")::integer AS "version" FROM "base_questions"',
  )) as Array<{ version: number }>;
  const currentVersion = versionRows[0]?.version;
  if (!Number.isInteger(currentVersion) || currentVersion < 1) {
    throw new Error('Migration 0036 requires an existing Question Bank.');
  }

  const currentQuestions = (await queryRunner.query(`
    SELECT
      "id", "stable_key" AS "stableKey", "topic", "control_point" AS "controlPoint",
      "text", "type"::text AS "type", "required",
      "required_for_estimate" AS "requiredForEstimate", "blocking",
      "display_order" AS "order", "active", "hint", "options",
      "source"::text AS "source"
    FROM "base_questions"
    WHERE "bank_version" = $1
    ORDER BY "display_order", "stable_key"
  `, [currentVersion])) as StoredQuestion[];

  const localizedQuestions = currentQuestions.map(localizeQuestion);
  if (!localizedQuestions.some(({ changed }) => changed)) return;

  const nextVersion = currentVersion + 1;
  const nextIdByCurrentId = new Map<string, string>();
  for (const { question } of localizedQuestions) {
    const nextId = randomUUID();
    nextIdByCurrentId.set(question.id, nextId);
    await queryRunner.query(`
      INSERT INTO "base_questions" (
        "id", "stable_key", "bank_version", "topic", "control_point", "text", "type",
        "required", "required_for_estimate", "blocking", "display_order", "active", "hint",
        "options", "source", "published_at"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::"base_question_type",
        $8, $9, $10, $11, $12, $13, $14::jsonb, $15::"base_question_source", CURRENT_TIMESTAMP
      )
    `, [
      nextId,
      question.stableKey,
      nextVersion,
      question.topic,
      question.controlPoint,
      question.text,
      question.type,
      question.required,
      question.requiredForEstimate,
      question.blocking,
      question.order,
      question.active,
      question.hint,
      question.options === null ? null : JSON.stringify(question.options),
      question.source,
    ]);
  }

  for (const [currentQuestionId, nextQuestionId] of nextIdByCurrentId) {
    await queryRunner.query(`
      INSERT INTO "question_reference_files" ("question_id", "file_id")
      SELECT $1, "file_id"
      FROM "question_reference_files"
      WHERE "question_id" = $2
    `, [nextQuestionId, currentQuestionId]);
  }
}

function localizeQuestion(question: StoredQuestion): {
  readonly question: StoredQuestion;
  readonly changed: boolean;
} {
  const match = /^(general|system-integration|data-migration)-(\d{3})$/.exec(question.stableKey);
  if (!match) return { question, changed: false };
  const itemIndex = Number(match[2]) - 1;
  const copy = generalQuestionCopy[itemIndex];
  if (!copy) return { question, changed: false };

  const playbook = match[1];
  const text = playbookField(copy.text, playbook, 'text');
  const hint = playbookField(copy.hint, playbook, 'hint');
  const localized = {
    ...question,
    topic: replaceUnmodified(question.topic, copy.topic),
    controlPoint: replaceUnmodified(question.controlPoint, copy.controlPoint),
    text: replaceUnmodified(question.text, text),
    hint: question.hint === null ? null : replaceUnmodified(question.hint, hint),
  };
  return {
    question: localized,
    changed:
      localized.topic !== question.topic ||
      localized.controlPoint !== question.controlPoint ||
      localized.text !== question.text ||
      localized.hint !== question.hint,
  };
}

function playbookField(
  copy: LocalizedField,
  playbook: string,
  kind: 'text' | 'hint',
): LocalizedField {
  if (playbook === 'general') return copy;
  const isIntegration = playbook === 'system-integration';
  const prefix = kind === 'text'
    ? isIntegration
      ? field('Integrációs nézőpont:', 'System integration perspective:')
      : field('Migrációs nézőpont:', 'Data migration perspective:')
    : isIntegration
      ? field('Térj ki a forrás- és célrendszer kapcsolatára.', 'Address the relationship between the source and target systems.')
      : field('Térj ki az adatminőségre, leképezésre és visszaállíthatóságra.', 'Address data quality, mapping, reconciliation, and recoverability.');
  return field(`${prefix.hu} ${copy.hu}`, `${prefix.en} ${copy.en}`);
}

function replaceUnmodified(value: string, copy: LocalizedField): string {
  return value === copy.hu ? copy.en : value;
}

async function publishEnglishDefaultTemplateSuccessor(queryRunner: QueryRunner): Promise<void> {
  const rows = (await queryRunner.query(`
    SELECT "name", "draft_content" AS "draftContent"
    FROM "markdown_templates"
    WHERE "id" = $1 AND "is_default" = true
  `, [defaultTemplateId])) as Array<{ name: string; draftContent: string }>;
  const template = rows[0];
  if (!template) return;

  const nextName = template.name === originalTemplateName ? englishTemplateName : template.name;
  const nextDraft = template.draftContent === originalTemplateContent
    ? englishTemplateContent
    : template.draftContent;
  if (nextName !== template.name || nextDraft !== template.draftContent) {
    await queryRunner.query(`
      UPDATE "markdown_templates"
      SET "name" = $2, "draft_content" = $3
      WHERE "id" = $1
    `, [defaultTemplateId, nextName, nextDraft]);
  }

  if (template.draftContent !== originalTemplateContent) return;
  const versionRows = (await queryRunner.query(`
    SELECT MAX("version")::integer AS "version"
    FROM "markdown_template_versions"
    WHERE "template_id" = $1
  `, [defaultTemplateId])) as Array<{ version: number }>;
  if (versionRows[0]?.version !== 1) return;
  await queryRunner.query(`
    INSERT INTO "markdown_template_versions" ("id", "template_id", "version", "content")
    VALUES ($1, $2, 2, $3)
  `, [randomUUID(), defaultTemplateId, englishTemplateContent]);
}
