import {
  baseQuestionTypes,
  type BaseQuestionType,
} from '@project-maker/contracts';

const labels: Readonly<Record<BaseQuestionType, string>> = {
  TEXT: 'Rövid szöveg',
  LONG_TEXT: 'Hosszú szöveg',
  SINGLE_SELECT: 'Egyszeres választás',
  MULTI_SELECT: 'Többszörös választás',
  BOOLEAN: 'Igen vagy nem',
  NUMBER: 'Szám',
  DATE: 'Dátum',
};

export const baseQuestionTypeOptions = baseQuestionTypes.map((value) => ({
  label: labels[value],
  value,
}));

export function baseQuestionTypeLabel(type: BaseQuestionType): string {
  return labels[type];
}
