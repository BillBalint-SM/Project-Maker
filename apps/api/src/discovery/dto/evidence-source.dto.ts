import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { evidenceSourceKinds, type EvidenceSourceKind } from '@project-maker/contracts/discovery-runtime';

const nonBlankPattern = /\S/;

export class EvidenceSourceDto {
  @IsIn([...evidenceSourceKinds])
  kind!: EvidenceSourceKind;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsUUID('4')
  roundId?: string;

  @IsOptional()
  @IsUUID('4')
  snapshotId?: string;

  @IsOptional()
  @IsUUID('4')
  correspondenceId?: string;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(2000)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  metricName?: string;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  metricValue?: string;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(100)
  metricUnit?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsUUID('4')
  attachmentId?: string;

  @IsOptional()
  @IsUUID('4')
  responseAnswerId?: string;
}
