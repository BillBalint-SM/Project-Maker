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

export interface PublishProjectQuestionSchemaInput {
  readonly questions: readonly ProjectSchemaQuestionInput[];
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
}

export interface ProjectQuestionSchema {
  readonly id: string;
  readonly projectId: string;
  readonly schemaVersion: number;
  readonly bankVersion: number;
  readonly publishedAt: string;
  readonly questions: readonly ProjectSchemaQuestion[];
}
