import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BaseQuestionType,
  DeliveryPackageItemInput,
} from '@project-maker/contracts';

import { DeliveryHandoffService } from '../delivery/delivery-handoff.service';
import { DeliveryPackageService } from '../delivery/delivery-package.service';
import { GitSetupService } from '../delivery/git-setup.service';
import { MarkdownService } from '../markdown/markdown.service';
import { MarkdownTemplateService } from '../markdown/markdown-template.service';
import { ProjectsService } from '../projects/projects.service';
import { QuestionBankService } from '../question-bank/question-bank.service';

export interface SaveQuestionBankQuestionInput {
  readonly operation: 'create' | 'update';
  readonly id?: string;
  readonly stableKey?: string;
  readonly topic?: string;
  readonly controlPoint?: string;
  readonly text?: string;
  readonly type?: BaseQuestionType;
  readonly required?: boolean;
  readonly requiredForEstimate?: boolean;
  readonly blocking?: boolean;
  readonly order?: number;
  readonly active?: boolean;
  readonly hint?: string | null;
  readonly options?: string[] | null;
}

export interface SaveMarkdownTemplateInput {
  readonly operation: 'create' | 'update';
  readonly id?: string;
  readonly name: string;
  readonly draftContent: string;
}

@Injectable()
export class ProjectMakerMcpFacade {
  constructor(
    private readonly projects: ProjectsService,
    private readonly markdown: MarkdownService,
    private readonly templates: MarkdownTemplateService,
    private readonly questionBank: QuestionBankService,
    private readonly packages: DeliveryPackageService,
    private readonly gitSetups: GitSetupService,
    private readonly handoffs: DeliveryHandoffService,
  ) {}

  async listProjects(includeArchived: boolean): Promise<unknown> {
    const projects = await this.projects.list();
    return includeArchived
      ? projects
      : projects.filter((project) => project.status !== 'ARCHIVED');
  }

  async getProjectContext(projectId: string): Promise<unknown> {
    const project = (await this.projects.list()).find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    const [specifications, deliveryPackage, handoffs] = await Promise.all([
      this.markdown.list(projectId),
      this.packages.get(projectId).catch((error: unknown) => {
        if (error instanceof NotFoundException) return null;
        throw error;
      }),
      this.handoffs.list(projectId),
    ]);
    return {
      project,
      specifications: specifications.map(({ id, version, reason, milestone, createdAt, changeSummary, template }) => ({
        id, version, reason, milestone, createdAt, changeSummary, template,
      })),
      deliveryPackage,
      handoffs,
    };
  }

  async readSpecification(projectId: string, revisionId?: string): Promise<unknown> {
    if (revisionId) {
      return this.markdown.find(projectId, revisionId);
    }
    const latest = (await this.markdown.list(projectId))[0];
    if (!latest) {
      throw new NotFoundException('The project has no specification versions yet.');
    }
    return latest;
  }

  generateSpecification(projectId: string, templateId?: string): Promise<unknown> {
    return this.markdown.create(projectId, {
      reason: 'MANUAL',
      ...(templateId ? { templateId } : {}),
    });
  }

  saveDeliveryPackage(
    projectId: string,
    specificationRevisionId: string,
    items: readonly DeliveryPackageItemInput[],
  ): Promise<unknown> {
    return this.packages.save(projectId, {
      specificationRevisionId,
      items: items.map((item) => ({
        ...item,
        acceptanceCriteria: [...item.acceptanceCriteria],
        sourceExcerpts: item.sourceExcerpts ? [...item.sourceExcerpts] : undefined,
      })),
    });
  }

  listGitSetups(): Promise<unknown> {
    return this.gitSetups.list();
  }

  previewGitHandoff(projectId: string, gitSetupId: string): Promise<unknown> {
    return this.handoffs.preview(projectId, gitSetupId);
  }

  confirmGitHandoff(projectId: string, previewToken: string): Promise<unknown> {
    return this.handoffs.confirm(projectId, previewToken);
  }

  getQuestionBank(): Promise<unknown> {
    return this.questionBank.getBaseQuestions();
  }

  saveQuestionBankQuestion(input: SaveQuestionBankQuestionInput): Promise<unknown> {
    const { operation, ...fields } = input;
    if (operation === 'create') {
      return this.questionBank.createBaseQuestion(fields as Parameters<QuestionBankService['createBaseQuestion']>[0]);
    }
    return this.questionBank.updateBaseQuestion(fields as Parameters<QuestionBankService['updateBaseQuestion']>[0]);
  }

  listMarkdownTemplates(): Promise<unknown> {
    return this.templates.list();
  }

  saveMarkdownTemplate(input: SaveMarkdownTemplateInput): Promise<unknown> {
    if (input.operation === 'create') {
      return this.templates.create({ name: input.name, draftContent: input.draftContent });
    }
    return this.templates.updateDraft(input.id!, {
      name: input.name,
      draftContent: input.draftContent,
    });
  }

  publishMarkdownTemplate(templateId: string): Promise<unknown> {
    return this.templates.publish(templateId);
  }
}
