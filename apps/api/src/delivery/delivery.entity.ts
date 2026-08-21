import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { DeliveryHandoffState, DeliveryPackageItem, GitAuthenticationMode } from '@project-maker/contracts';

@Entity({ name: 'delivery_packages' })
export class DeliveryPackageEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'uuid' }) projectId!: string;
  @Column({ name: 'specification_revision_id', type: 'uuid' }) specificationRevisionId!: string;
  @Column({ name: 'specification_version', type: 'integer' }) specificationVersion!: number;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'jsonb' }) items!: DeliveryPackageItem[];
  @Column({ name: 'created_by', type: 'varchar', length: 100 }) createdBy!: string;
  @Column({ name: 'updated_by', type: 'varchar', length: 100 }) updatedBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

@Entity({ name: 'git_setups' })
export class GitSetupEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ name: 'remote_url', type: 'text' }) remoteUrl!: string;
  @Column({ type: 'varchar', length: 255 }) branch!: string;
  @Column({ name: 'authentication_mode', type: 'varchar', length: 20 }) authenticationMode!: GitAuthenticationMode;
  @Column({ type: 'varchar', length: 255, nullable: true }) username!: string | null;
  @Column({ name: 'credential_ciphertext', type: 'text' }) credentialCiphertext!: string;
  @Column({ name: 'repository_web_url', type: 'text', nullable: true }) repositoryWebUrl!: string | null;
  @Column({ type: 'integer' }) version!: number;
  @Column({ name: 'created_by', type: 'varchar', length: 100 }) createdBy!: string;
  @Column({ name: 'updated_by', type: 'varchar', length: 100 }) updatedBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}

export interface GitTargetSnapshot {
  readonly setupId: string;
  readonly setupVersion: number;
  readonly setupName: string;
  readonly remoteUrl: string;
  readonly branch: string;
  readonly repositoryWebUrl: string | null;
}

export interface DeliveryPackageSnapshot {
  readonly packageId: string;
  readonly packageVersion: number;
  readonly specificationRevisionId: string;
  readonly specificationVersion: number;
  readonly items: readonly DeliveryPackageItem[];
}

@Entity({ name: 'delivery_handoffs' })
export class DeliveryHandoffEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'uuid' }) projectId!: string;
  @Column({ name: 'delivery_package_id', type: 'uuid' }) deliveryPackageId!: string;
  @Column({ name: 'package_version', type: 'integer' }) packageVersion!: number;
  @Column({ name: 'git_setup_id', type: 'uuid', nullable: true }) gitSetupId!: string | null;
  @Column({ name: 'preview_id', type: 'uuid' }) previewId!: string;
  @Column({ name: 'target_digest', type: 'varchar', length: 64 }) targetDigest!: string;
  @Column({ name: 'target_snapshot', type: 'jsonb' }) targetSnapshot!: GitTargetSnapshot;
  @Column({ name: 'package_snapshot', type: 'jsonb' }) packageSnapshot!: DeliveryPackageSnapshot;
  @Column({ name: 'artifact_path', type: 'text' }) artifactPath!: string;
  @Column({ name: 'artifact_content', type: 'text' }) artifactContent!: string;
  @Column({ name: 'artifact_digest', type: 'varchar', length: 64 }) artifactDigest!: string;
  @Column({ name: 'commit_message', type: 'varchar', length: 255 }) commitMessage!: string;
  @Column({ type: 'varchar', length: 20 }) state!: DeliveryHandoffState;
  @Column({ name: 'expected_commit_sha', type: 'varchar', length: 64, nullable: true }) expectedCommitSha!: string | null;
  @Column({ name: 'commit_sha', type: 'varchar', length: 64, nullable: true }) commitSha!: string | null;
  @Column({ name: 'repository_backlink', type: 'text', nullable: true }) repositoryBacklink!: string | null;
  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true }) failureCode!: string | null;
  @Column({ name: 'attempt_count', type: 'integer' }) attemptCount!: number;
  @Column({ name: 'created_by', type: 'varchar', length: 100 }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
