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
      if (project.status === 'ARCHIVED') throw new ConflictException('Archivált projekt fejlesztési csomagja nem szerkeszthető.');
      const revision = await manager.getRepository(MarkdownRevisionEntity).findOneBy({
        id: input.specificationRevisionId,
        projectId,
      });
      if (!revision) throw new BadRequestException('A kiválasztott specifikációverzió nem ehhez a projekthez tartozik.');
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
    if (!deliveryPackage) throw new NotFoundException('Ehhez a projekthez még nincs fejlesztési csomag.');
    const revision = await this.dataSource.getRepository(MarkdownRevisionEntity).findOneBy({
      id: deliveryPackage.specificationRevisionId,
      projectId,
    });
    if (!revision) throw new NotFoundException('A fejlesztési csomag specifikációforrása nem található.');
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
    const header = ['Projekt', 'Projekt ID', 'Specifikációverzió', 'Csomagverzió', 'Tétel sorszám', 'Cím', 'User story', 'Kritérium sorszám', 'Elfogadási kritérium', 'Forrásrészletek'];
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
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(view.projectName)} – Fejlesztési csomag</title><style>body{font:16px/1.5 system-ui;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#172033}button{padding:.7rem 1rem}@media print{button{display:none}}article{break-inside:avoid;margin:2rem 0}li{margin:.35rem 0}blockquote{border-left:.2rem solid #64748b;margin-left:0;padding-left:1rem;white-space:pre-wrap}</style></head><body><button type="button" onclick="window.print()">Nyomtatás / Mentés PDF-ként</button><main><h1>${escapeHtml(view.projectName)} – Fejlesztési csomag</h1><p>Specifikációverzió: v${view.specification.version} · Csomagverzió: v${view.version} · Állapot: ${view.provenance.state === 'HANDED_OFF' ? 'Gitbe átadva' : 'Szerkesztett változat'}</p>${view.items.map((item, index) => `<article><h2>${index + 1}. ${escapeHtml(item.title)}</h2><p><strong>User story</strong><br>${escapeHtml(item.userStory)}</p><h3>Elfogadási kritériumok</h3><ol>${item.acceptanceCriteria.map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join('')}</ol>${item.sourceExcerpts.length ? `<h3>Forrásrészletek</h3>${item.sourceExcerpts.map((excerpt) => `<blockquote>${escapeHtml(excerpt)}</blockquote>`).join('')}` : ''}</article>`).join('')}</main></body></html>`;
  }

  async entity(projectId: string): Promise<DeliveryPackageEntity> {
    const entity = await this.dataSource.getRepository(DeliveryPackageEntity).findOneBy({ projectId });
    if (!entity) throw new ConflictException('A Git-átadás előtt ments fejlesztési csomagot.');
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
    if (ids.has(id)) throw new BadRequestException('Egy fejlesztési csomag tétele csak egyszer szerepelhet.');
    ids.add(id);
    const title = requiredText(item.title, 255, 'A tétel címe');
    const userStory = requiredText(item.userStory, 4_000, 'A user story');
    const acceptanceCriteria = item.acceptanceCriteria.map((criterion) => requiredText(criterion, 4_000, 'Az elfogadási kritérium'));
    const sourceExcerpts = (item.sourceExcerpts ?? []).map((excerpt) => {
      const exact = requiredText(excerpt, 2_000, 'A forrásrészlet');
      if (!specification.includes(exact)) throw new BadRequestException('A forrásrészlet nem található pontosan a kiválasztott specifikációverzióban.');
      return exact;
    });
    return { id, title, userStory, acceptanceCriteria, sourceExcerpts };
  });
}

function requiredText(value: string, max: number, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new BadRequestException(`${label} üres vagy túl hosszú.`);
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
    ? `Gitbe átadva (${view.provenance.commitSha ?? 'SHA nem elérhető'})`
    : 'Szerkesztett, még nem Gitbe átadott változat';
  const items = view.items.map((item, index) => [
    `## ${index + 1}. ${item.title}`,
    '', '**User story**', '', item.userStory,
    '', '**Elfogadási kritériumok**', '',
    ...item.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    ...(item.sourceExcerpts.length ? ['', '**Pontos forrásrészletek**', '', ...item.sourceExcerpts.flatMap((excerpt) => excerpt.split('\n').map((line) => `> ${line}`))] : []),
  ].join('\n')).join('\n\n');
  return [
    `# Fejlesztési csomag — ${view.projectName}`, '',
    `- Project ID: \`${view.projectId}\``,
    `- Csomagverzió: v${view.version}`,
    `- Specifikációverzió: v${view.specification.version} (\`${view.specification.id}\`)`,
    `- Állapot: ${status}`, '', items, '',
    '# Kanonikus specifikáció', '', specification, '',
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
