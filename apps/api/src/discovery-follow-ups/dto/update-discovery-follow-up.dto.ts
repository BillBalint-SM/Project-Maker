import { IsInt, Min } from 'class-validator';
import type { UpdateDiscoveryFollowUpInput } from '@project-maker/contracts';

import { CreateDiscoveryFollowUpDto } from './create-discovery-follow-up.dto';

export class UpdateDiscoveryFollowUpDto
  extends CreateDiscoveryFollowUpDto
  implements UpdateDiscoveryFollowUpInput
{
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
