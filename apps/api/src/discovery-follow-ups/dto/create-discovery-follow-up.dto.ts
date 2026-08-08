import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import type { CreateDiscoveryFollowUpInput } from '@project-maker/contracts';
import {
  discoveryFollowUpCategories,
  type DiscoveryFollowUpCategory,
} from '@project-maker/contracts/discovery-follow-ups';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const nonBlankPattern = /\S/;

export class CreateDiscoveryFollowUpDto implements CreateDiscoveryFollowUpInput {
  @IsIn(discoveryFollowUpCategories)
  category!: DiscoveryFollowUpCategory;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(10_000)
  question!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  owner!: string;

  @IsString()
  @Matches(dateOnlyPattern)
  @IsISO8601({ strict: true })
  dueDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(10_000)
  nextStep!: string;
}
