import { Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, Min, ValidateIf } from 'class-validator';
import type { CustomerMailTriageCommand } from '@project-maker/contracts';

const commands = ['LINK', 'DISMISS'] as const;

export class CustomerMailTriageCommandDto {
  @IsIn(commands)
  command!: CustomerMailTriageCommand['command'];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ValidateIf((input: CustomerMailTriageCommandDto) => input.command === 'LINK')
  @IsUUID()
  correspondenceId?: string;
}
