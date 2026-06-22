import { checklistTemplate } from "../data/checklist";
import type {
  ChecklistAnswer,
  ChecklistStatus,
  CompletionState,
  DecisionScores,
  GapTargetTab,
  FollowUpQuestion,
  Project,
  ProjectCompletion,
  ProjectListItem
} from "../data/types";

const defaultOwner = "TBD";

export const defaultDecisionScores: DecisionScores = {
  businessValue: 3,
  strategicAlignment: 3,
  urgency: 3,
  confidence: 3,
  complexity: 3,
  risk: 3
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDraftName(date = new Date()) {
  const padded = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    padded(date.getMonth() + 1),
    padded(date.getDate())
  ].join(".");
  const time = `${padded(date.getHours())}:${padded(date.getMinutes())}`;
  return `Névtelen projekt - ${stamp} ${time}`;
}

export function createDefaultChecklistAnswers(): Record<number, ChecklistAnswer> {
  return Object.fromEntries(
    checklistTemplate.map((item) => [
      item.id,
      {
        status: "Nincs meg" as ChecklistStatus,
        owner: defaultOwner,
        dueDate: "",
        answer: "",
        openQuestion: "",
        nextStep: "",
        updatedAt: ""
      }
    ])
  );
}

export function createDraftProject(): Project {
  const timestamp = nowIso();
  const draft: Project = {
    id: makeId(),
    name: formatDraftName(),
    customerOrOrganization: "",
    projectManager: "",
    businessAnalyst: "",
    productOwner: "",
    techLead: "",
    affectedTeams: [],
    contactPhone: "",
    contactEmail: "",
    contactOther: "",
    kickoffDate: "",
    plannedDecisionDate: "",
    status: "Előkészítés",
    priority: "Alap",
    deadline: "",
    businessProblem: "",
    expectedBusinessOutcome: "",
    firstMvpGoal: "",
    finalDecision: "",
    decisionDate: "",
    decisionMaker: "",
    decisionNote: "",
    decisionScores: { ...defaultDecisionScores },
    checklistAnswers: createDefaultChecklistAnswers(),
    followUps: [],
    completion: emptyCompletion(),
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return recalculateProject(draft);
}

export function recalculateProject(project: Project): Project {
  const normalized = normalizeProject(project);

  return {
    ...normalized,
    completion: calculateCompletion(normalized)
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    affectedTeams: project.affectedTeams ?? [],
    decisionScores: {
      ...defaultDecisionScores,
      ...(project.decisionScores ?? {})
    },
    checklistAnswers: {
      ...createDefaultChecklistAnswers(),
      ...(project.checklistAnswers ?? {})
    },
    followUps: project.followUps ?? [],
    archivedAt: project.archivedAt ?? null
  };
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function scoreTextFields(values: string[]) {
  if (values.length === 0) return 1;
  return values.filter(hasText).length / values.length;
}

function checklistWeightedRatio(project: Project) {
  const relevantItems = checklistTemplate.filter((item) => {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    return status !== "Nem releváns";
  });

  if (relevantItems.length === 0) return 1;

  const score = relevantItems.reduce((sum, item) => {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    if (status === "Kész") return sum + 1;
    if (status === "Részben megvan") return sum + 0.5;
    return sum;
  }, 0);

  return score / relevantItems.length;
}

function followUpResolutionRatio(project: Project) {
  if (project.followUps.length === 0) return 1;

  const closed = project.followUps.filter((followUp) =>
    ["Megválaszolva", "Nem releváns"].includes(followUp.status)
  ).length;

  return closed / project.followUps.length;
}

function addGap(
  gaps: ProjectCompletion["readinessGaps"],
  severity: ProjectCompletion["readinessGaps"][number]["severity"],
  category: string,
  message: string,
  nextStep: string,
  target: {
    targetTab: GapTargetTab;
    targetField?: string;
    checklistItemId?: number;
    followUpId?: string;
  }
) {
  gaps.push({ severity, category, message, nextStep, ...target });
}

function collectReadinessGaps(project: Project) {
  const gaps: ProjectCompletion["readinessGaps"] = [];
  const hasContact =
    hasText(project.contactPhone) ||
    hasText(project.contactEmail) ||
    hasText(project.contactOther);

  if (!hasText(project.customerOrOrganization)) {
    addGap(
      gaps,
      "Fontos",
      "Alapadatok",
      "Nincs megadva ügyfél vagy szervezet.",
      "Rögzítsd, melyik üzleti területhez vagy szervezethez tartozik az igény.",
      { targetTab: "overview", targetField: "customerOrOrganization" }
    );
  }

  if (!hasContact) {
    addGap(
      gaps,
      "Fontos",
      "Kapcsolat",
      "Nincs megadva elérhetőség.",
      "Adj meg telefonszámot, e-mailt vagy egyéb kapcsolati pontot.",
      { targetTab: "overview", targetField: "contactEmail" }
    );
  }

  if (!hasText(project.productOwner)) {
    addGap(
      gaps,
      "Kritikus",
      "Felelősök",
      "Nincs Product Owner vagy üzleti felelős.",
      "Jelöld ki az üzleti döntésekért és elfogadásért felelős személyt.",
      { targetTab: "overview", targetField: "productOwner" }
    );
  }

  if (!hasText(project.businessProblem)) {
    addGap(
      gaps,
      "Kritikus",
      "Üzleti cél",
      "Hiányzik a rövid üzleti probléma.",
      "Fogalmazd meg, milyen problémát old meg a projekt.",
      { targetTab: "overview", targetField: "businessProblem" }
    );
  }

  if (!hasText(project.expectedBusinessOutcome)) {
    addGap(
      gaps,
      "Kritikus",
      "Üzleti érték",
      "Hiányzik az elvárt üzleti eredmény.",
      "Rögzíts mérhető vagy egyértelműen validálható eredményt.",
      { targetTab: "overview", targetField: "expectedBusinessOutcome" }
    );
  }

  if (!hasText(project.firstMvpGoal)) {
    addGap(
      gaps,
      "Fontos",
      "MVP scope",
      "Nincs leírva az első MVP cél.",
      "Határozd meg, mi legyen az első szállítható működő verzió.",
      { targetTab: "overview", targetField: "firstMvpGoal" }
    );
  }

  if (!hasText(project.deadline)) {
    addGap(
      gaps,
      "Pontosítás",
      "Határidő",
      "Nincs megadva határidő.",
      "Add meg a cél- vagy döntési dátumot, ha van üzleti időkorlát.",
      { targetTab: "overview", targetField: "deadline" }
    );
  }

  for (const item of checklistTemplate) {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    const isMissing = status === "Nincs meg" || status === "Részben megvan";

    if (item.requiredForEstimate && item.blockingIfMissing && isMissing) {
      addGap(
        gaps,
        item.requiredForMvp ? "Kritikus" : "Fontos",
        item.category,
        `${item.id}. ${item.controlPoint}`,
        item.exampleQuestion,
        { targetTab: "checklist", checklistItemId: item.id }
      );
    }
  }

  project.followUps
    .filter((followUp) => ["Nyitott", "Folyamatban", "Blokkolt"].includes(followUp.status))
    .forEach((followUp) => {
      addGap(
        gaps,
        followUp.status === "Blokkolt" ? "Kritikus" : "Pontosítás",
        followUp.category || "Follow-up",
        followUp.question || "Nyitott follow-up kérdés.",
        followUp.nextStep || "Zárd le vagy jelölj ki felelőst és határidőt.",
        { targetTab: "followups", followUpId: followUp.id }
      );
    });

  const severityRank = {
    Kritikus: 0,
    Fontos: 1,
    Pontosítás: 2
  };

  return gaps.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function calculateReadinessPercent(project: Project) {
  const baseInfoScore = scoreTextFields([
    project.name,
    project.customerOrOrganization,
    project.deadline,
    project.contactPhone || project.contactEmail || project.contactOther
  ]);
  const businessScore = scoreTextFields([
    project.businessProblem,
    project.expectedBusinessOutcome,
    project.firstMvpGoal
  ]);
  const ownershipScore = scoreTextFields([
    project.projectManager,
    project.productOwner,
    project.businessAnalyst || project.techLead
  ]);

  return Math.round(
    (baseInfoScore * 0.2 +
      businessScore * 0.2 +
      ownershipScore * 0.15 +
      checklistWeightedRatio(project) * 0.3 +
      followUpResolutionRatio(project) * 0.15) *
      100
  );
}

function readinessState(readinessPercent: number, criticalGaps: number) {
  if (criticalGaps > 0 || readinessPercent < 55) return "Pontosítás szükséges";
  if (readinessPercent < 75) return "Becslésre előkészíthető";
  if (readinessPercent < 90) return "Becslésre kész";
  return "Fejlesztésre kész";
}

function scaleToPercent(value: number) {
  return Math.max(1, Math.min(5, value)) * 20;
}

function inverseScaleToPercent(value: number) {
  return (6 - Math.max(1, Math.min(5, value))) * 20;
}

function calculateDecisionScore(project: Project, readinessPercent: number) {
  const scores = project.decisionScores;

  return Math.round(
    scaleToPercent(scores.businessValue) * 0.25 +
      scaleToPercent(scores.strategicAlignment) * 0.15 +
      scaleToPercent(scores.urgency) * 0.15 +
      scaleToPercent(scores.confidence) * 0.15 +
      inverseScaleToPercent(scores.complexity) * 0.1 +
      inverseScaleToPercent(scores.risk) * 0.1 +
      readinessPercent * 0.1
  );
}

function decisionLabel(score: number) {
  if (score >= 75) return "Magas";
  if (score >= 55) return "Közepes";
  return "Alacsony";
}

function decisionRecommendation(
  score: number,
  readinessPercent: number,
  criticalGaps: number,
  estimateBlockingMissing: number
) {
  if (criticalGaps > 0 || estimateBlockingMissing > 2 || readinessPercent < 55) {
    return "Pontosítás szükséges";
  }

  if (score >= 75 && readinessPercent >= 75 && estimateBlockingMissing === 0) {
    return "Becslésre vihető";
  }

  if (score >= 55 && readinessPercent >= 65) {
    return "Feltételes becslés";
  }

  return "Alacsony prioritás / későbbi kör";
}

function nextRecommendedAction(recommendation: string, gaps: ProjectCompletion["readinessGaps"]) {
  if (recommendation === "Becslésre vihető") {
    return "Küldhető becslésre vagy technikai előkészítésre.";
  }

  if (recommendation === "Feltételes becslés") {
    return "Sávos becslés kérhető, a fontos hiányok párhuzamos pontosításával.";
  }

  const firstGap = gaps[0];
  return firstGap?.nextStep ?? "Érdemes újrapriorizálni vagy későbbi körbe tenni.";
}

export function calculateCompletion(project: Project): ProjectCompletion {
  const answers = project.checklistAnswers;
  const totalItems = checklistTemplate.length;
  let doneItems = 0;
  let partialItems = 0;
  let missingItems = 0;
  let notRelevantItems = 0;
  let mvpCriticalMissing = 0;
  let estimateBlockingMissing = 0;

  for (const item of checklistTemplate) {
    const status = answers[item.id]?.status ?? "Nincs meg";

    if (status === "Kész") {
      doneItems += 1;
    }

    if (status === "Részben megvan") {
      partialItems += 1;
    }

    if (status === "Nincs meg") {
      missingItems += 1;
    }

    if (status === "Nem releváns") {
      notRelevantItems += 1;
    }

    if (item.requiredForMvp && status === "Nincs meg") {
      mvpCriticalMissing += 1;
    }

    if (
      item.requiredForEstimate &&
      item.blockingIfMissing &&
      (status === "Nincs meg" || status === "Részben megvan")
    ) {
      estimateBlockingMissing += 1;
    }
  }

  const relevantItems = Math.max(totalItems - notRelevantItems, 1);
  const percent = Math.round((doneItems / relevantItems) * 100);
  const openFollowUps = project.followUps.filter((item) =>
    ["Nyitott", "Folyamatban", "Blokkolt"].includes(item.status)
  ).length;
  const readinessGaps = collectReadinessGaps(project);
  const criticalGaps = readinessGaps.filter((gap) => gap.severity === "Kritikus").length;
  const readinessPercent = calculateReadinessPercent(project);
  const decisionScore = calculateDecisionScore(project, readinessPercent);
  const recommendation = decisionRecommendation(
    decisionScore,
    readinessPercent,
    criticalGaps,
    estimateBlockingMissing
  );

  const hasBlockingGap = mvpCriticalMissing > 0 || estimateBlockingMissing > 0;
  const allRelevantDone = doneItems === relevantItems;
  const state: CompletionState = hasBlockingGap
    ? "Pontosítás szükséges"
    : allRelevantDone
      ? "Kész"
      : "Folyamatban";

  return {
    percent,
    state,
    readinessPercent,
    readinessState: readinessState(readinessPercent, criticalGaps),
    totalItems,
    doneItems,
    partialItems,
    missingItems,
    notRelevantItems,
    mvpCriticalMissing,
    estimateBlockingMissing,
    openFollowUps,
    estimateReadiness:
      estimateBlockingMissing === 0
        ? "Igen"
        : estimateBlockingMissing <= 2
          ? "Feltételes / sávos becslés"
          : "Nem, további tisztázás kell",
    developmentReadiness:
      mvpCriticalMissing === 0 && estimateBlockingMissing === 0
        ? "Igen"
        : mvpCriticalMissing === 0 && estimateBlockingMissing <= 2
          ? "Feltételes Go"
          : "No-Go / tisztázás szükséges",
    decisionScore,
    decisionScoreLabel: decisionLabel(decisionScore),
    decisionRecommendation: recommendation,
    nextRecommendedAction: nextRecommendedAction(recommendation, readinessGaps),
    readinessGaps
  };
}

export function emptyCompletion(): ProjectCompletion {
  return {
    percent: 0,
    state: "Folyamatban",
    readinessPercent: 0,
    readinessState: "Pontosítás szükséges",
    totalItems: checklistTemplate.length,
    doneItems: 0,
    partialItems: 0,
    missingItems: checklistTemplate.length,
    notRelevantItems: 0,
    mvpCriticalMissing: 0,
    estimateBlockingMissing: 0,
    openFollowUps: 0,
    estimateReadiness: "Nem, további tisztázás kell",
    developmentReadiness: "No-Go / tisztázás szükséges",
    decisionScore: 0,
    decisionScoreLabel: "Alacsony",
    decisionRecommendation: "Pontosítás szükséges",
    nextRecommendedAction: "Töltsd ki az alapadatokat és a kritikus checklist pontokat.",
    readinessGaps: []
  };
}

export function toProjectListItem(project: Project): ProjectListItem {
  return {
    id: project.id,
    name: project.name,
    contact: [project.contactPhone, project.contactEmail, project.contactOther]
      .filter(Boolean)
      .join(" | "),
    status: project.status,
    priority: project.priority,
    deadline: project.deadline,
    completionState: project.completion.state,
    completionPercent: project.completion.percent,
    readinessPercent: project.completion.readinessPercent,
    decisionScore: project.completion.decisionScore,
    decisionRecommendation: project.completion.decisionRecommendation,
    archivedAt: project.archivedAt,
    updatedAt: project.updatedAt
  };
}

export function createFollowUpFromChecklist(
  project: Project,
  checklistItemId: number
): FollowUpQuestion {
  const template = checklistTemplate.find((item) => item.id === checklistItemId);
  const answer = project.checklistAnswers[checklistItemId];

  return {
    id: makeId(),
    sourceChecklistItemId: checklistItemId,
    category: template?.category ?? "",
    question: answer?.openQuestion || template?.exampleQuestion || "",
    owner: answer?.owner || defaultOwner,
    dueDate: answer?.dueDate || "",
    status: "Nyitott",
    decisionOrAnswer: "",
    nextStep: answer?.nextStep || ""
  };
}

export function touchProject(project: Project): Project {
  return recalculateProject({
    ...project,
    updatedAt: nowIso()
  });
}
