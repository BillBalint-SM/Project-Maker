import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import type { GovernedAttachmentOwnerKind } from '@project-maker/contracts';

@Entity({ name: 'governed_attachments' })
export class GovernedAttachmentEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'owner_kind', type: 'varchar', length: 40 })
  ownerKind!: GovernedAttachmentOwnerKind;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 100 })
  contentType!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @Column({ type: 'bytea' })
  content!: Buffer;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
