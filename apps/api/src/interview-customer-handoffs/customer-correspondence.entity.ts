import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import type { CustomerCorrespondenceStatus } from '@project-maker/contracts';

@Entity({ name: 'customer_correspondences' })
export class CustomerCorrespondenceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'outbound_communication_id', type: 'uuid', unique: true })
  outboundCommunicationId!: string;

  @Column({ name: 'predecessor_id', type: 'uuid', nullable: true })
  predecessorId!: string | null;

  @Column({ type: 'varchar', length: 40, default: 'Válaszra vár' })
  status!: CustomerCorrespondenceStatus;

  @Column({ name: 'unread_message_count', type: 'integer', default: 0 })
  unreadMessageCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
