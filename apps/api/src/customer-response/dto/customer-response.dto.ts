import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { CustomerResponsePromptSourceKind } from '@project-maker/contracts';
import { customerResponsePromptSourceKinds } from '@project-maker/contracts/customer-response-runtime';

class PromptSelectionDto {
  @IsIn([...customerResponsePromptSourceKinds]) sourceKind!: CustomerResponsePromptSourceKind;
  @IsUUID('4') sourceId!: string;
}

export class PreviewCustomerResponseRequestDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => PromptSelectionDto)
  prompts!: PromptSelectionDto[];
}

export class ConfirmCustomerResponseRequestDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/) @MaxLength(400_000)
  previewToken!: string;
}

export class ExchangeCustomerResponseCapabilityDto {
  @IsString() @MaxLength(500)
  token!: string;
}

class CustomerResponseAnswerDto {
  @IsUUID('4') promptId!: string;
  @IsString() @Matches(/\S/) @MaxLength(10_000) answer!: string;
}

export class SubmitCustomerResponseDto {
  @IsUUID('4') idempotencyKey!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => CustomerResponseAnswerDto)
  answers!: CustomerResponseAnswerDto[];
}
