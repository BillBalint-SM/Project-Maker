import { checklistTemplate } from "../data/checklist";
import type { ExportPreset, Project } from "../data/types";

export type ExportCell = string | number;
export type ExportKeyValueRow = [string, string];

export type ExportKeyValueSection = {
  type: "keyValue";
  title: string;
  rows: ExportKeyValueRow[];
};

export type ExportTableSection = {
  type: "table";
  title: string;
  head: string[];
  body: ExportCell[][];
};

export type ExportSection = ExportKeyValueSection | ExportTableSection;

export type ExportColumn = {
  wch: number;
};

export type ProjectExportPlan = {
  title: string;
  sections: ExportSection[];
};

export type ProjectsExportPlan = {
  projects: ProjectExportPlan[];
  summaryRows: ExportCell[][];
  summaryColumns: ExportColumn[];
  detailColumns: ExportColumn[];
};

export function valueOrDash(value: ExportCell | null | undefined) {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
}

function joinValues(values: Array<string | null | undefined>) {
  return values.map(valueOrDash).filter((value) => value !== "-").join(" | ") || "-";
}

function projectSummaryRows(project: Project): ExportKeyValueRow[] {
  return [
    ["Projekt neve", valueOrDash(project.name)],
    ["Ügyfél / szervezet", valueOrDash(project.customerOrOrganization)],
    ["Kapcsolat", joinValues([project.contactPhone, project.contactEmail, project.contactOther])],
    ["Státusz", project.status],
    ["Prioritás", project.priority],
    ["Határidő", valueOrDash(project.deadline)],
    ["Kitöltöttség", `${project.completion.state} (${project.completion.percent}%)`],
    ["Readiness", `${project.completion.readinessPercent}% - ${project.completion.readinessState}`],
    ["Decision Score", `${project.completion.decisionScore}/100 - ${project.completion.decisionScoreLabel}`],
    ["Döntési javaslat", project.completion.decisionRecommendation],
    ["Becslés adható?", project.completion.estimateReadiness],
    ["Fejlesztés indítható?", project.completion.developmentReadiness],
    ["Frissítve", valueOrDash(project.updatedAt)]
  ];
}

function projectOwnerRows(project: Project): ExportKeyValueRow[] {
  return [
    ["Projekt Manager", valueOrDash(project.projectManager)],
    ["Business Analyst", valueOrDash(project.businessAnalyst)],
    ["Product Owner / üzleti felelős", valueOrDash(project.productOwner)],
    ["Tech Lead", valueOrDash(project.techLead)],
    ["Érintett csapat / szállító", valueOrDash(project.affectedTeams.join(", "))]
  ];
}

function businessSummaryRows(project: Project): ExportKeyValueRow[] {
  return [
    ["Rövid üzleti probléma", valueOrDash(project.businessProblem)],
    ["Elvárt üzleti eredmény", valueOrDash(project.expectedBusinessOutcome)],
    ["Első MVP cél", valueOrDash(project.firstMvpGoal)]
  ];
}

function decisionBlockRows(project: Project): ExportKeyValueRow[] {
  return [
    ["Végső döntés", valueOrDash(project.finalDecision)],
    ["Döntés dátuma", valueOrDash(project.decisionDate)],
    ["Döntéshozó", valueOrDash(project.decisionMaker)],
    ["Megjegyzés", valueOrDash(project.decisionNote)]
  ];
}

function decisionScoreRows(project: Project): ExportKeyValueRow[] {
  return [
    ["Readiness", `${project.completion.readinessPercent}%`],
    ["Decision Score", `${project.completion.decisionScore}/100`],
    ["Döntési javaslat", project.completion.decisionRecommendation],
    ["Következő lépés", project.completion.nextRecommendedAction],
    ["Üzleti érték", `${project.decisionScores.businessValue}/5`],
    ["Stratégiai illeszkedés", `${project.decisionScores.strategicAlignment}/5`],
    ["Sürgősség", `${project.decisionScores.urgency}/5`],
    ["Confidence", `${project.decisionScores.confidence}/5`],
    ["Komplexitás", `${project.decisionScores.complexity}/5`],
    ["Kockázat", `${project.decisionScores.risk}/5`]
  ];
}

function readinessGapRows(project: Project): ExportCell[][] {
  return project.completion.readinessGaps.map((gap) => [
    gap.severity,
    gap.category,
    gap.message,
    gap.nextStep
  ]);
}

function checklistRows(project: Project): ExportCell[][] {
  return checklistTemplate.map((item) => {
    const answer = project.checklistAnswers[item.id];

    return [
      item.id,
      item.category,
      item.controlPoint,
      answer?.status ?? "Nincs meg",
      valueOrDash(answer?.owner),
      valueOrDash(answer?.dueDate),
      valueOrDash(answer?.answer),
      valueOrDash(answer?.openQuestion),
      valueOrDash(answer?.nextStep)
    ];
  });
}

function followUpRows(project: Project): ExportCell[][] {
  return project.followUps.map((followUp) => [
    followUp.category || "-",
    valueOrDash(followUp.question),
    valueOrDash(followUp.owner),
    valueOrDash(followUp.dueDate),
    followUp.status,
    valueOrDash(followUp.decisionOrAnswer),
    valueOrDash(followUp.nextStep)
  ]);
}

function followUpSection(project: Project): ExportTableSection {
  return {
    type: "table",
    title: "Nyitott kérdések / follow-up",
    head: [
      "Kategória",
      "Kérdés",
      "Felelős",
      "Határidő",
      "Státusz",
      "Döntés / válasz",
      "Következő lépés"
    ],
    body: followUpRows(project)
  };
}

function summaryRows(projects: Project[]): ExportCell[][] {
  return [
    [
      "Projekt neve",
      "Kapcsolat",
      "Státusz",
      "Prioritás",
      "Határidő",
      "Kitöltöttség",
      "Készültség %",
      "Readiness %",
      "Decision Score",
      "Döntési javaslat",
      "Becslés adható?",
      "Fejlesztés indítható?",
      "Frissítve"
    ],
    ...projects.map((project) => [
      valueOrDash(project.name),
      joinValues([project.contactPhone, project.contactEmail, project.contactOther]),
      project.status,
      project.priority,
      valueOrDash(project.deadline),
      project.completion.state,
      project.completion.percent,
      project.completion.readinessPercent,
      project.completion.decisionScore,
      project.completion.decisionRecommendation,
      project.completion.estimateReadiness,
      project.completion.developmentReadiness,
      valueOrDash(project.updatedAt)
    ])
  ];
}

export function buildProjectExportPlan(
  project: Project,
  preset: ExportPreset
): ProjectExportPlan {
  const sections: ExportSection[] = [
    {
      type: "keyValue",
      title: "Projekt összefoglaló",
      rows: projectSummaryRows(project)
    },
    {
      type: "keyValue",
      title: "Decision Cockpit",
      rows: decisionScoreRows(project)
    },
    {
      type: "table",
      title: "Hiányzó információk",
      head: ["Súlyosság", "Kategória", "Hiány", "Következő lépés"],
      body: readinessGapRows(project)
    }
  ];

  if (preset === "gaps") {
    sections.push(followUpSection(project));
    return {
      title: valueOrDash(project.name),
      sections
    };
  }

  sections.push(
    {
      type: "keyValue",
      title: "Felelősök",
      rows: projectOwnerRows(project)
    },
    {
      type: "keyValue",
      title: "Üzleti összefoglaló",
      rows: businessSummaryRows(project)
    }
  );

  if (preset === "full") {
    sections.push(
      {
        type: "table",
        title: "Checklist",
        head: [
          "#",
          "Kategória",
          "Kontrollpont",
          "Státusz",
          "Felelős",
          "Határidő",
          "Válasz",
          "Nyitott kérdés",
          "Következő lépés"
        ],
        body: checklistRows(project)
      },
      followUpSection(project)
    );
  }

  sections.push({
    type: "keyValue",
    title: "Döntési blokk",
    rows: decisionBlockRows(project)
  });

  return {
    title: valueOrDash(project.name),
    sections
  };
}

export function buildProjectsExportPlan(
  projects: Project[],
  preset: ExportPreset
): ProjectsExportPlan {
  return {
    projects: projects.map((project) => buildProjectExportPlan(project, preset)),
    summaryRows: summaryRows(projects),
    summaryColumns: [
      { wch: 34 },
      { wch: 36 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 24 },
      { wch: 28 },
      { wch: 32 },
      { wch: 26 }
    ],
    detailColumns: [
      { wch: 22 },
      { wch: 34 },
      { wch: 44 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 52 },
      { wch: 52 },
      { wch: 52 }
    ]
  };
}
