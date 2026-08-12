import { IsUUID, ValidateIf } from 'class-validator';

import type { CreateDiscoveryFollowUpInput } from '@project-maker/contracts';
import { DiscoveryFollowUpDetailsDto } from './discovery-follow-up-details.dto';

export class CreateDiscoveryFollowUpDto
  extends DiscoveryFollowUpDetailsDto
  implements CreateDiscoveryFollowUpInput
{
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  sourceSnapshotId?: string;
}
