import { IsInt, IsUUID, Min, ValidateIf } from 'class-validator';
import type { SetDiscoveryFollowUpSourceLinkInput } from '@project-maker/contracts';

export class SetDiscoveryFollowUpSourceLinkDto
  implements SetDiscoveryFollowUpSourceLinkInput
{
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  sourceSnapshotId!: string | null;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
