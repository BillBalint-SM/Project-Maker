import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import type { ResolveDiscoveryFollowUpInput } from '@project-maker/contracts';

const nonBlankPattern = /\S/;

export class ResolveDiscoveryFollowUpDto implements ResolveDiscoveryFollowUpInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  status!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(10_000)
  decisionOrAnswer!: string;
}
