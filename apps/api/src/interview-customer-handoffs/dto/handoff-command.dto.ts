import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateIf } from 'class-validator';
import { exactPteCustomerSenderAddressPattern } from '@project-maker/contracts/customer-mail';

export class PreviewHandoffDto {
  @IsIn(['DEDICATED', 'CUSTOM'])
  mode!: 'DEDICATED' | 'CUSTOM';

  @ValidateIf((input: PreviewHandoffDto) => input.mode === 'CUSTOM')
  @IsString()
  @Length(1, 320)
  @IsEmail()
  @Matches(exactPteCustomerSenderAddressPattern)
  address?: string;
}

export class UpdateHandoffDraftDto {
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  modificationSummary?: string | null;
}

export class SendHandoffDto {
  @IsInt()
  @Min(1)
  sourceContentVersion!: number;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  previewDigest!: string;

  @IsString()
  @Length(1, 320)
  @IsEmail()
  @Matches(exactPteCustomerSenderAddressPattern)
  senderAddress!: string;
}

export class RetryHandoffDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeDuplicateRisk?: boolean;
}
