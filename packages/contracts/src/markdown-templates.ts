export const markdownTemplatePlaceholderNames = [
  'project.name',
  'revision.metadata',
  'project.context',
  'project.schema',
  'project.initialIntake',
  'project.readiness',
  'project.decisionReview',
] as const;

export type MarkdownTemplatePlaceholderName =
  (typeof markdownTemplatePlaceholderNames)[number];

export interface MarkdownTemplatePlaceholderDefinition {
  readonly name: MarkdownTemplatePlaceholderName;
  readonly label: string;
  readonly optional: boolean;
}

export const markdownTemplatePlaceholderDefinitions: readonly MarkdownTemplatePlaceholderDefinition[] = [
  { name: 'project.name', label: 'Project name', optional: false },
  { name: 'revision.metadata', label: 'Specification version metadata', optional: false },
  { name: 'project.context', label: 'Project context', optional: false },
  { name: 'project.schema', label: 'Accepted Project question schema', optional: true },
  { name: 'project.initialIntake', label: 'Initial Intake', optional: true },
  { name: 'project.readiness', label: 'Estimation readiness', optional: true },
  { name: 'project.decisionReview', label: 'Decision Review', optional: true },
];

export interface MarkdownTemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly draftContent: string;
  readonly latestPublishedVersion: number | null;
  readonly isDefault: boolean;
  readonly updatedAt: string;
}

export interface MarkdownTemplatePreview {
  readonly content: string;
}

export interface CreateMarkdownTemplateInput {
  readonly name: string;
  readonly draftContent: string;
}

export interface UpdateMarkdownTemplateDraftInput {
  readonly name: string;
  readonly draftContent: string;
}
