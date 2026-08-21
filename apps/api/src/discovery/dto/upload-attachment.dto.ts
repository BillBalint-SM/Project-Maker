import { IsIn, IsUUID } from 'class-validator';

import {
  governedAttachmentOwnerKinds,
  type GovernedAttachmentOwnerKind,
} from '@project-maker/contracts/discovery-runtime';

export class UploadAttachmentDto {
  @IsIn([...governedAttachmentOwnerKinds])
  ownerKind!: GovernedAttachmentOwnerKind;

  @IsUUID('4')
  ownerId!: string;
}
