import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  DeliveryPackage,
  DeliveryPackageArtifact,
  DeliveryPackageItem,
  DeliveryPackageItemInput,
  DeliveryPackageProvenance,
} from '@project-maker/contracts';
import { DataSource, EntityManager } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { currentAuditActorId } from '../audit/audit-actor';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { Project } from '../projects/project.entity';
import { DeliveryHandoffEntity, DeliveryPackageEntity } from './delivery.entity';
import { SaveDeliveryPackageDto } from './dto/delivery.dto';

@Injectable()
export class DeliveryPackageService {
  constructor(private readonly dataSource: DataSource) {}

  async save(projectId: string, input: SaveDeliveryPackageDto): Promise<DeliveryPackage> {
    await this.dataSource.transaction(async (manager) => {
      const project = await requireProject(manager, projectId, true);
      if (project.status === 'ARCHIVED') throw new ConflictException('The Delivery package of an archived Project cannot be edited.');
      const revision = await manager.getRepository(MarkdownRevisionEntity).findOneBy({
        id: input.specificationRevisionId,
        projectId,
      });
      if (!revision) throw new BadRequestException('The selected specification version does not belong to this Project.');
      const items = normalizeItems(input.items, revision.content);
      const repository = manager.getRepository(DeliveryPackageEntity);
      let deliveryPackage = await repository.findOne({
        where: { projectId },
        lock: { mode: 'pessimistic_write' },
      });
      const actor = currentAuditActorId();
      if (deliveryPackage) {
        deliveryPackage.specificationRevisionId = revision.id;
        deliveryPackage.specificationVersion = revision.version;
        deliveryPackage.version += 1;
        deliveryPackage.items = items;
        deliveryPackage.updatedBy = actor;
      } else {
        deliveryPackage = repository.create({
          id: randomUUID(), projectId, specificationRevisionId: revision.id,
          specificationVersion: revision.version, version: 1, items,
          createdBy: actor, updatedBy: actor,
        });
      }
      const saved = await repository.save(deliveryPackage);
      await manager.getRepository(AuditEvent).save({
        id: randomUUID(), projectId, eventType: 'DELIVERY_PACKAGE_SAVED',
        payload: {
          deliveryPackageId: saved.id,
          packageVersion: String(saved.version),
          specificationRevisionId: revision.id,
          specificationVersion: String(revision.version),
          itemCount: String(items.length),
        },
      });
    });
    return this.get(projectId);
  }

  async get(projectId: string): Promise<DeliveryPackage> {
    const project = await requireProject(this.dataSource.manager, projectId, false);
    const deliveryPackage = await this.dataSource.getRepository(DeliveryPackageEntity).findOneBy({ projectId });
    if (!deliveryPackage) throw new NotFoundException('This Project does not have a Delivery package yet.');
    const revision = await this.dataSource.getRepository(MarkdownRevisionEntity).findOneBy({
      id: deliveryPackage.specificationRevisionId,
      projectId,
    });
    if (!revision) throw new NotFoundException('The source specification for this Delivery package could not be found.');
    return toView(project, deliveryPackage, revision, await this.provenance(deliveryPackage));
  }

  async artifact(projectId: string): Promise<DeliveryPackageArtifact> {
    const view = await this.get(projectId);
    const revision = await this.dataSource.getRepository(MarkdownRevisionEntity).findOneByOrFail({
      id: view.specification.id,
      projectId,
    });
    const content = renderMarkdown(view, revision.content);
    return {
      filename: `project-${projectId}-delivery-v${view.version}.md`,
      mediaType: 'text/markdown',
      content,
      digest: sha256(content),
      provenance: view.provenance,
    };
  }

  async csv(projectId: string): Promise<{ readonly filename: string; readonly content: string }> {
    const view = await this.get(projectId);
    const header = ['Project', 'Project ID', 'Specification version', 'Package version', 'Item number', 'Title', 'User story', 'Criterion number', 'Acceptance criterion', 'Source excerpts'];
    const rows = view.items.flatMap((item, itemIndex) => item.acceptanceCriteria.map((criterion, criterionIndex) => [
      view.projectName, view.projectId, String(view.specification.version), String(view.version),
      String(itemIndex + 1), item.title, item.userStory, String(criterionIndex + 1), criterion,
      item.sourceExcerpts.join('\n---\n'),
    ]));
    const content = '\ufeff' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
    return { filename: `project-${projectId}-delivery-v${view.version}.csv`, content };
  }

  async printHtml(projectId: string): Promise<string> {
    const view = await this.get(projectId);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(view.projectName)} – Delivery package</title><style>body{font:16px/1.5 system-ui;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#172033}button{padding:.7rem 1rem}@media print{button{display:none}}article{break-inside:avoid;margin:2rem 0}li{margin:.35rem 0}blockquote{border-left:.2rem solid #64748b;margin-left:0;padding-left:1rem;white-space:pre-wrap}</style></head><body><button type="button" onclick="window.print()">Print / Save as PDF</button><main><h1>${escapeHtml(view.projectName)} – Delivery package</h1><p>Specification version: v${view.specification.version} · Package version: v${view.version} · Status: ${view.provenance.state === 'HANDED_OFF' ? 'Handed off to Git' : 'Working version'}</p>${view.items.map((item, index) => `<article><h2>${index + 1}. ${escapeHtml(item.title)}</h2><p><strong>User story</strong><br>${escapeHtml(item.userStory)}</p><h3>Acceptance criteria</h3><ol>${item.acceptanceCriteria.map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join('')}</ol>${item.sourceExcerpts.length ? `<h3>Source excerpts</h3>${item.sourceExcerpts.map((excerpt) => `<blockquote>${escapeHtml(excerpt)}</blockquote>`).join('')}` : ''}</article>`).join('')}</main></body></html>`;
  }

  async entity(projectId: string): Promise<DeliveryPackageEntity> {
    const entity = await this.dataSource.getRepository(DeliveryPackageEntity).findOneBy({ projectId });
    if (!entity) throw new ConflictException('Save the Delivery package before starting a Git handoff.');
    return entity;
  }

  async revision(entity: DeliveryPackageEntity): Promise<MarkdownRevisionEntity> {
    return this.dataSource.getRepository(MarkdownRevisionEntity).findOneByOrFail({
      id: entity.specificationRevisionId,
      projectId: entity.projectId,
    });
  }

  private async provenance(deliveryPackage: DeliveryPackageEntity): Promise<DeliveryPackageProvenance> {
    const handoff = await this.dataSource.getRepository(DeliveryHandoffEntity).findOne({
      where: { deliveryPackageId: deliveryPackage.id, packageVersion: deliveryPackage.version, state: 'SENT' },
      order: { updatedAt: 'DESC' },
    });
    return handoff ? {
      state: 'HANDED_OFF', commitSha: handoff.commitSha, handedOffAt: handoff.updatedAt.toISOString(),
    } : { state: 'DRAFT', commitSha: null, handedOffAt: null };
  }
}

async function requireProject(manager: EntityManager, id: string, lock: boolean): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id }, lock: lock ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!project) throw new NotFoundException('Project not found.');
  return project;
}

function normalizeItems(items: readonly DeliveryPackageItemInput[], specification: string): DeliveryPackageItem[] {
  const ids = new Set<string>();
  return items.map((item) => {
    const id = item.id ?? randomUUID();
    if (ids.has(id)) throw new BadRequestException('Each Delivery package item may appear only once.');
    ids.add(id);
    const title = requiredText(item.title, 255, 'Item title');
    const userStory = requiredText(item.userStory, 4_000, 'User story');
    const acceptanceCriteria = item.acceptanceCriteria.map((criterion) => requiredText(criterion, 4_000, 'Acceptance criterion'));
    const sourceExcerpts = (item.sourceExcerpts ?? []).map((excerpt) => {
      const exact = requiredText(excerpt, 2_000, 'Source excerpt');
      if (!specification.includes(exact)) throw new BadRequestException('The source excerpt is not an exact match within the selected specification version.');
      return exact;
    });
    return { id, title, userStory, acceptanceCriteria, sourceExcerpts };
  });
}

function requiredText(value: string, max: number, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new BadRequestException(`${label} is empty or exceeds the maximum length.`);
  return normalized;
}

function toView(
  project: Project,
  entity: DeliveryPackageEntity,
  revision: MarkdownRevisionEntity,
  provenance: DeliveryPackageProvenance,
): DeliveryPackage {
  return {
    id: entity.id, projectId: entity.projectId, projectName: project.name, version: entity.version,
    specification: { id: revision.id, version: revision.version, createdAt: revision.createdAt.toISOString() },
    items: entity.items, provenance,
    createdAt: entity.createdAt.toISOString(), updatedAt: entity.updatedAt.toISOString(), updatedBy: entity.updatedBy,
  };
}

function renderMarkdown(view: DeliveryPackage, specification: string): string {
  const status = view.provenance.state === 'HANDED_OFF'
    ? `Handed off to Git (${view.provenance.commitSha ?? 'SHA unavailable'})`
    : 'Working version not yet handed off to Git';
  const items = view.items.map((item, index) => [
    `## ${index + 1}. ${item.title}`,
    '', '**User story**', '', item.userStory,
    '', '**Acceptance criteria**', '',
    ...item.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    ...(item.sourceExcerpts.length ? ['', '**Exact source excerpts**', '', ...item.sourceExcerpts.flatMap((excerpt) => excerpt.split('\n').map((line) => `> ${line}`))] : []),
  ].join('\n')).join('\n\n');
  return [
    `# Delivery package — ${view.projectName}`, '',
    `- Project ID: \`${view.projectId}\``,
    `- Package version: v${view.version}`,
    `- Specification version: v${view.specification.version} (\`${view.specification.id}\`)`,
    `- Status: ${status}`, '', items, '',
    '# Canonical specification', '', specification, '',
  ].join('\n');
}

function csvCell(value: string): string {
  const neutralized = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
