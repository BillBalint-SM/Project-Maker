import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import {
  customerCorrespondenceStatuses,
  customerInboundMessageClassifications,
} from '@project-maker/contracts/customer-mail';
import type {
  CustomerCorrespondenceCommand,
  CustomerCorrespondenceStatus,
  CustomerInboundMessageClassification,
} from '@project-maker/contracts';

const commands = ['MARK_REVIEWED', 'SET_STATUS', 'CLASSIFY_MESSAGE'] as const;

export class CustomerCorrespondenceCommandDto {
  @IsIn(commands)
  command!: CustomerCorrespondenceCommand['command'];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ValidateIf((input: CustomerCorrespondenceCommandDto) => input.command === 'SET_STATUS')
  @IsIn(customerCorrespondenceStatuses)
  status?: CustomerCorrespondenceStatus;

  @ValidateIf((input: CustomerCorrespondenceCommandDto) => input.command === 'CLASSIFY_MESSAGE')
  @IsUUID()
  messageId?: string;

  @ValidateIf((input: CustomerCorrespondenceCommandDto) => input.command === 'CLASSIFY_MESSAGE')
  @IsIn(customerInboundMessageClassifications)
  classification?: CustomerInboundMessageClassification;

  @IsOptional()
  @IsBoolean()
  closeCorrespondence?: boolean;
}
