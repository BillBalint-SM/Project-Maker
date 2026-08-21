import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { Project } from '../projects/project.entity';
import { CredentialCrypto } from './credential-crypto';
import { DeliveryHandoffEntity, DeliveryPackageEntity, GitSetupEntity } from './delivery.entity';
import { DeliveryPackageController } from './delivery-package.controller';
import { DeliveryPackageService } from './delivery-package.service';
import { DeliveryHandoffController } from './delivery-handoff.controller';
import { DeliveryHandoffService } from './delivery-handoff.service';
import { GitClient } from './git-client';
import { GitSetupController } from './git-setup.controller';
import { GitSetupService } from './git-setup.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    AuditEvent,
    DeliveryHandoffEntity,
    DeliveryPackageEntity,
    GitSetupEntity,
    MarkdownRevisionEntity,
    Project,
  ])],
  controllers: [DeliveryPackageController, DeliveryHandoffController, GitSetupController],
  providers: [CredentialCrypto, DeliveryPackageService, DeliveryHandoffService, GitClient, GitSetupService],
  exports: [CredentialCrypto, DeliveryPackageService, DeliveryHandoffService, GitClient, GitSetupService],
})
export class DeliveryModule {}
