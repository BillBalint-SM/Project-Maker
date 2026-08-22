import {
  baseQuestionTypes,
  type BaseQuestionType,
} from '@project-maker/contracts';

const labels: Readonly<Record<BaseQuestionType, string>> = {
  TEXT: 'Short text',
  LONG_TEXT: 'Long text',
  SINGLE_SELECT: 'Single select',
  MULTI_SELECT: 'Multiple select',
  BOOLEAN: 'Yes / No',
  NUMBER: 'Number',
  DATE: 'Date',
};

export const baseQuestionTypeOptions = baseQuestionTypes.map((value) => ({
  label: labels[value],
  value,
}));

export function baseQuestionTypeLabel(type: BaseQuestionType): string {
  return labels[type];
}
