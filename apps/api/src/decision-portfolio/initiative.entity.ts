import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'initiatives' })
export class InitiativeEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'goal_id', type: 'uuid' }) goalId!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'varchar', length: 2000, nullable: true }) description!: string | null;
  @Column({ name: 'created_by', type: 'varchar', length: 100 }) createdBy!: string;
  @Column({ name: 'updated_by', type: 'varchar', length: 100 }) updatedBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
