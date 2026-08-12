import { IsInt, Min } from 'class-validator';
import type { UpdateDiscoveryFollowUpInput } from '@project-maker/contracts';

import { DiscoveryFollowUpDetailsDto } from './discovery-follow-up-details.dto';

export class UpdateDiscoveryFollowUpDto
  extends DiscoveryFollowUpDetailsDto
  implements UpdateDiscoveryFollowUpInput
{
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
