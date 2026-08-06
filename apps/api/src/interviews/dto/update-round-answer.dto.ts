import {
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import type { AnswerValue } from '@project-maker/contracts';

@ValidatorConstraint({ name: 'answerValue', async: false })
class AnswerValueConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (Array.isArray(value) && value.every((item) => typeof item === 'string'))
    );
  }

  defaultMessage(_arguments: ValidationArguments): string {
    return 'value must be null, a string, a finite number, a boolean, or an array of strings.';
  }
}

export class UpdateRoundAnswerDto {
  @Validate(AnswerValueConstraint)
  value!: AnswerValue | null;
}
