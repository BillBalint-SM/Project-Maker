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
