export const baseQuestionTypes = [
  'TEXT',
  'LONG_TEXT',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'BOOLEAN',
  'NUMBER',
  'DATE',
] as const;

export type BaseQuestionType = (typeof baseQuestionTypes)[number];

export interface QuestionReferenceFile {
  readonly id: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly createdAt: string;
}

export interface BaseQuestion {
  readonly id: string;
  readonly stableKey: string;
  readonly bankVersion: number;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
  readonly type: BaseQuestionType;
  readonly required: boolean;
  readonly requiredForEstimate: boolean;
  readonly blocking: boolean;
  readonly order: number;
  readonly active: boolean;
  readonly hint: string | null;
  readonly options: readonly string[] | null;
  readonly source: 'CANONICAL_SEED' | 'SETTINGS_API';
  readonly publishedAt: string;
  readonly referenceFiles: readonly QuestionReferenceFile[];
}

export interface BaseQuestionBank {
  readonly version: number;
  readonly questions: readonly BaseQuestion[];
}

export interface CreateBaseQuestionInput {
  readonly stableKey: string;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
  readonly type: BaseQuestionType;
  readonly required: boolean;
  readonly requiredForEstimate: boolean;
  readonly blocking: boolean;
  readonly order: number;
  readonly active: boolean;
  readonly hint?: string | null;
  readonly options?: readonly string[] | null;
}

export interface UpdateBaseQuestionInput {
  readonly id: string;
  readonly topic?: string;
  readonly controlPoint?: string;
  readonly text?: string;
  readonly type?: BaseQuestionType;
  readonly required?: boolean;
  readonly requiredForEstimate?: boolean;
  readonly blocking?: boolean;
  readonly order?: number;
  readonly active?: boolean;
  readonly hint?: string | null;
  readonly options?: readonly string[] | null;
}

export interface ProjectSchemaQuestionInput {
  readonly stableKey: string;
  readonly required?: boolean;
  readonly blocking?: boolean;
}

export type PublishProjectQuestionSchemaInput =
  | {
      readonly questions: readonly ProjectSchemaQuestionInput[];
      readonly questionTemplateId?: never;
    }
  | {
      readonly questions?: never;
      readonly questionTemplateId: string;
    };

export type QuestionTemplateState = 'DRAFT' | 'PUBLISHED' | 'CHANGES_PENDING';

export interface QuestionTemplateProjectAssignment {
  readonly projectId: string;
  readonly projectName: string;
  readonly schemaVersion: number;
}

export interface QuestionTemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly draftQuestions: readonly ProjectSchemaQuestionInput[];
  readonly latestPublishedVersion: number | null;
  readonly latestPublishedQuestions: readonly ProjectSchemaQuestionInput[] | null;
  readonly state: QuestionTemplateState;
  readonly unavailableQuestionCount: number;
  readonly assignedProjects: readonly QuestionTemplateProjectAssignment[];
  readonly updatedAt: string;
}

export interface CreateQuestionTemplateInput {
  readonly name: string;
  readonly questions: readonly ProjectSchemaQuestionInput[];
}

export interface UpdateQuestionTemplateDraftInput extends CreateQuestionTemplateInput {}

export interface QuestionTemplateProvenance {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

export interface ProjectSchemaQuestion {
  readonly id: string;
  readonly baseQuestionId: string;
  readonly stableKey: string;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
  readonly type: BaseQuestionType;
  readonly required: boolean;
  readonly blocking: boolean;
  readonly order: number;
  readonly hint: string | null;
  readonly options: readonly string[] | null;
  readonly referenceFiles: readonly QuestionReferenceFile[];
}

export interface ProjectQuestionSchema {
  readonly id: string;
  readonly projectId: string;
  readonly schemaVersion: number;
  readonly bankVersion: number;
  readonly publishedAt: string;
  readonly questionTemplate: QuestionTemplateProvenance | null;
  readonly questions: readonly ProjectSchemaQuestion[];
}
