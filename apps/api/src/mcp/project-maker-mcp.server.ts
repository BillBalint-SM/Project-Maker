import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { runWithAuditActor } from '../audit/audit-actor';
import { baseQuestionTypeValues } from '../question-bank/base-question.entity';
import {
  ProjectMakerMcpFacade,
  type SaveMarkdownTemplateInput,
  type SaveQuestionBankQuestionInput,
} from './project-maker-mcp.facade';

const uuid = z.string().uuid();
const deliveryItem = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(255),
  userStory: z.string().trim().min(1).max(4_000),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(4_000)).min(1).max(20),
  sourceExcerpts: z.array(z.string().trim().min(1).max(2_000)).max(20).optional(),
});
const questionFields = {
  topic: z.string().trim().min(1).max(255),
  controlPoint: z.string().trim().min(1),
  text: z.string().trim().min(1),
  type: z.enum(baseQuestionTypeValues),
  required: z.boolean(),
  requiredForEstimate: z.boolean(),
  blocking: z.boolean(),
  order: z.number().int().min(1),
  active: z.boolean(),
  hint: z.string().nullable().optional(),
  options: z.array(z.string()).min(1).nullable().optional(),
} as const;
const saveQuestion = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create'),
    stableKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
    ...questionFields,
  }),
  z.object({
    operation: z.literal('update'),
    id: uuid,
    topic: questionFields.topic.optional(),
    controlPoint: questionFields.controlPoint.optional(),
    text: questionFields.text.optional(),
    type: questionFields.type.optional(),
    required: questionFields.required.optional(),
    requiredForEstimate: questionFields.requiredForEstimate.optional(),
    blocking: questionFields.blocking.optional(),
    order: questionFields.order.optional(),
    active: questionFields.active.optional(),
    hint: questionFields.hint,
    options: questionFields.options,
  }),
]);
const saveTemplate = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create'),
    name: z.string().trim().min(1).max(255),
    draftContent: z.string().trim().min(1).max(100_000),
  }),
  z.object({
    operation: z.literal('update'),
    id: uuid,
    name: z.string().trim().min(1).max(255),
    draftContent: z.string().trim().min(1).max(100_000),
  }),
]);

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const internalWrite = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function createProjectMakerMcpServer(
  facade: ProjectMakerMcpFacade,
  actorId: string,
): McpServer {
  const server = new McpServer({ name: 'project-maker', version: '1.0.0' });

  server.registerTool('list_projects', {
    title: 'List Project Maker projects',
    description: 'Lists active Project Maker projects and, when requested, archived projects.',
    inputSchema: z.object({ includeArchived: z.boolean().optional().default(false) }),
    annotations: readOnly,
  }, ({ includeArchived }) => call(actorId, () => facade.listProjects(includeArchived)));

  server.registerTool('get_project_context', {
    title: 'Get project work context',
    description: 'Returns core project data, specification versions, the delivery package, and Git handoff history.',
    inputSchema: z.object({ projectId: uuid }),
    annotations: readOnly,
  }, ({ projectId }) => call(actorId, () => facade.getProjectContext(projectId)));

  server.registerTool('read_specification', {
    title: 'Read project specification',
    description: 'Returns the requested or latest immutable Project Maker Markdown specification.',
    inputSchema: z.object({ projectId: uuid, revisionId: uuid.optional() }),
    annotations: readOnly,
  }, ({ projectId, revisionId }) => call(actorId, () => facade.readSpecification(projectId, revisionId)));

  server.registerTool('generate_specification', {
    title: 'Generate a new specification version',
    description: 'Uses the existing Project Maker generator to create a new immutable Markdown specification version.',
    inputSchema: z.object({ projectId: uuid, templateId: uuid.optional() }),
    annotations: internalWrite,
  }, ({ projectId, templateId }) => call(actorId, () => facade.generateSpecification(projectId, templateId)));

  server.registerTool('save_delivery_package', {
    title: 'Save delivery package',
    description: 'Saves edited delivery items for an exact specification version using existing Project Maker rules.',
    inputSchema: z.object({
      projectId: uuid,
      specificationRevisionId: uuid,
      items: z.array(deliveryItem).min(1).max(50),
    }),
    annotations: internalWrite,
  }, ({ projectId, specificationRevisionId, items }) => call(actorId, () => (
    facade.saveDeliveryPackage(projectId, specificationRevisionId, items)
  )));

  server.registerTool('list_git_setups', {
    title: 'List shared Git setups',
    description: 'Lists the deployment’s shared Git setups with credentials masked.',
    inputSchema: z.object({}),
    annotations: readOnly,
  }, () => call(actorId, () => facade.listGitSetups()));

  server.registerTool('preview_git_handoff', {
    title: 'Preview Git handoff',
    description: 'Shows the exact target remote, branch, file, and content without sending anything.',
    inputSchema: z.object({ projectId: uuid, gitSetupId: uuid }),
    annotations: readOnly,
  }, ({ projectId, gitSetupId }) => call(actorId, () => facade.previewGitHandoff(projectId, gitSetupId)));

  server.registerTool('confirm_git_handoff', {
    title: 'Confirm Git handoff',
    description: 'Initiates the retained delivery package Git handoff only with a fresh Project Maker preview token.',
    inputSchema: z.object({ projectId: uuid, previewToken: z.string().min(1).max(20_000) }),
    annotations: { ...internalWrite, idempotentHint: true, openWorldHint: true },
    _meta: { 'anthropic/requiresUserInteraction': true },
  }, ({ projectId, previewToken }) => call(actorId, () => facade.confirmGitHandoff(projectId, previewToken)));

  server.registerTool('get_question_bank', {
    title: 'Get Question Bank',
    description: 'Returns the shared current Project Maker Question Bank version.',
    inputSchema: z.object({}),
    annotations: readOnly,
  }, () => call(actorId, () => facade.getQuestionBank()));

  server.registerTool('save_question_bank_question', {
    title: 'Save Question Bank question',
    description: 'Creates a shared question or updates an existing one in a new Question Bank version.',
    inputSchema: saveQuestion,
    annotations: internalWrite,
  }, (input) => call(actorId, () => facade.saveQuestionBankQuestion(input as SaveQuestionBankQuestionInput)));

  server.registerTool('list_markdown_templates', {
    title: 'List Markdown templates',
    description: 'Lists shared specification Markdown templates and their drafts.',
    inputSchema: z.object({}),
    annotations: readOnly,
  }, () => call(actorId, () => facade.listMarkdownTemplates()));

  server.registerTool('save_markdown_template', {
    title: 'Save Markdown template draft',
    description: 'Creates a shared template or updates an existing draft; it does not publish automatically.',
    inputSchema: saveTemplate,
    annotations: internalWrite,
  }, (input) => call(actorId, () => facade.saveMarkdownTemplate(input as SaveMarkdownTemplateInput)));

  server.registerTool('publish_markdown_template', {
    title: 'Publish Markdown template',
    description: 'Creates a new immutable published version from the selected template’s current draft.',
    inputSchema: z.object({ templateId: uuid }),
    annotations: internalWrite,
  }, ({ templateId }) => call(actorId, () => facade.publishMarkdownTemplate(templateId)));

  return server;
}

async function call(actorId: string, action: () => Promise<unknown>): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const value = await runWithAuditActor(actorId, action);
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}
