import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type {
  ConfirmDeliveryHandoffInput,
  DeliveryPackageItemInput,
  GitAuthenticationMode,
  PreviewDeliveryHandoffInput,
  SaveDeliveryPackageInput,
  SaveGitSetupInput,
} from '@project-maker/contracts';

export class DeliveryPackageItemDto implements DeliveryPackageItemInput {
  @IsOptional() @IsUUID('4') id?: string;
  @IsString() @MaxLength(255) title!: string;
  @IsString() @MaxLength(4_000) userStory!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(4_000, { each: true })
  acceptanceCriteria!: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(2_000, { each: true })
  sourceExcerpts?: string[];
}

export class SaveDeliveryPackageDto implements SaveDeliveryPackageInput {
  @IsUUID('4') specificationRevisionId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => DeliveryPackageItemDto)
  items!: DeliveryPackageItemDto[];
}

export class GitCredentialDto {
  @IsOptional() @IsString() @MaxLength(20_000) accessToken?: string;
  @IsOptional() @IsString() @MaxLength(40_000) privateKey?: string;
  @IsOptional() @IsString() @MaxLength(10_000) passphrase?: string | null;
}

export class SaveGitSetupDto implements SaveGitSetupInput {
  @IsString() @MaxLength(255) name!: string;
  @IsString() @MaxLength(2_000) remoteUrl!: string;
  @IsString() @MaxLength(255) branch!: string;
  @IsIn(['HTTPS_TOKEN', 'SSH_KEY']) authenticationMode!: GitAuthenticationMode;
  @IsOptional() @IsString() @MaxLength(255) username?: string | null;
  @IsOptional() @ValidateNested() @Type(() => GitCredentialDto) credential?: GitCredentialDto;
  @IsOptional() @IsString() @MaxLength(2_000) repositoryWebUrl?: string | null;
}

export class PreviewDeliveryHandoffDto implements PreviewDeliveryHandoffInput {
  @IsUUID('4') gitSetupId!: string;
}

export class ConfirmDeliveryHandoffDto implements ConfirmDeliveryHandoffInput {
  @IsString() @MaxLength(20_000) previewToken!: string;
}
