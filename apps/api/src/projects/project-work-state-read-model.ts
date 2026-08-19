import { Injectable } from '@nestjs/common';
import type {
  ActiveProjectQueueGroupCounts,
  ActiveProjectQueueQuery,
  ActiveProjectUrgency,
  NextActionOwnerRole,
  ProjectPreparationState,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import { DataSource } from 'typeorm';

export interface ActiveProjectQueueReadAnchor {
  readonly urgency: ActiveProjectUrgency;
  readonly dueAt: string | null;
  readonly projectName: string;
  readonly projectId: string;
}

export interface ActiveProjectQueueReadCursor {
  readonly direction: 'NEXT' | 'PREVIOUS';
  readonly anchor: ActiveProjectQueueReadAnchor;
}

export interface ProjectWorkStateReadRow {
  readonly projectId: string;
  readonly projectName: string;
  readonly customerContactName: string;
  readonly internalOwnerName: string | null;
  readonly nextActionOwnerRole: NextActionOwnerRole | null;
  readonly nextAction: string | null;
  readonly dueAt: string | null;
  readonly urgency: ActiveProjectUrgency;
  readonly newReplyCount: number;
  readonly preparationState: ProjectPreparationState;
  readonly answeredQuestions: number;
  readonly totalQuestions: number;
  readonly completedDecisionInputs: number;
}

export interface ActiveProjectQueueReadPage {
  readonly rows: readonly ProjectWorkStateReadRow[];
  readonly totalCount: number;
  readonly groupCounts: ActiveProjectQueueGroupCounts;
  readonly anchorExists: boolean;
}

interface ProjectWorkStateReadInput {
  readonly query: ActiveProjectQueueQuery;
  readonly cursor: ActiveProjectQueueReadCursor | null;
  readonly now: Date;
  readonly dueSoonUntil: Date;
  readonly projectIds: readonly string[] | null;
  readonly includeArchived: boolean;
  readonly boundedPage: boolean;
}

interface RawQueuePage {
  readonly items: readonly RawQueueRow[];
  readonly total_count: number | string;
  readonly customer_reply_count: number | string;
  readonly overdue_count: number | string;
  readonly due_soon_count: number | string;
  readonly in_progress_count: number | string;
  readonly anchor_exists: boolean;
}

interface RawQueueRow {
  readonly project_id: string;
  readonly project_name: string;
  readonly customer_contact_name: string;
  readonly internal_owner_name: string | null;
  readonly next_action_owner_role: NextActionOwnerRole | null;
  readonly next_action: string | null;
  readonly due_at: string | null;
  readonly urgency: ActiveProjectUrgency;
  readonly new_reply_count: number | string;
  readonly preparation_state: ProjectPreparationState;
  readonly answered_questions: number | string;
  readonly total_questions: number | string;
  readonly completed_decision_inputs: number | string;
}

const normalizedProjectNameSql =
  `translate(lower(project.name), 'áéíóöőúüű' || U&'\\0301\\0308\\030B', 'aeiooouuu')`;
const orderedDueAtSql = `COALESCE(due_at, 'infinity'::timestamptz)`;

@Injectable()
export class ProjectWorkStateReadModel {
  constructor(private readonly dataSource: DataSource) {}

  async getPage(input: {
    readonly query: ActiveProjectQueueQuery;
    readonly cursor: ActiveProjectQueueReadCursor | null;
    readonly now: Date;
    readonly dueSoonUntil: Date;
  }): Promise<ActiveProjectQueueReadPage> {
    return this.read({
      ...input,
      projectIds: null,
      includeArchived: false,
      boundedPage: true,
    });
  }

  async getWorkStates(input: {
    readonly projectIds: readonly string[];
    readonly includeArchived: boolean;
    readonly now: Date;
    readonly dueSoonUntil: Date;
  }): Promise<readonly ProjectWorkStateReadRow[]> {
    if (input.projectIds.length === 0) return [];
    const page = await this.read({
      query: {},
      cursor: null,
      ...input,
      boundedPage: false,
    });
    return page.rows;
  }

  private async read(input: ProjectWorkStateReadInput): Promise<ActiveProjectQueueReadPage> {
    const policy = await loadGeneralPlaybookV1();
    const parameters: unknown[] = [];
    const bind = (value: unknown): string => {
      parameters.push(value);
      return `$${parameters.length}`;
    };
    const expectedStableKeys = policy.items.map(
      (item) => `${policy.id}-${String(item.id).padStart(3, '0')}`,
    );
    const stableKeys = (itemIds: readonly number[]) => itemIds.map(
      (itemId) => `${policy.id}-${String(itemId).padStart(3, '0')}`,
    );
    const readiness = policy.scoring.readiness;
    const decision = policy.scoring.decision;
    const search = normalizeProjectName(input.query.search?.trim() ?? '');
    const cursor = input.cursor;
    const direction = cursor?.direction ?? 'NEXT';
    const orderDirection = direction === 'PREVIOUS' ? 'DESC' : 'ASC';
    const cursorComparison = direction === 'PREVIOUS' ? '<' : '>';
    const nowParameter = bind(input.now.toISOString());
    const dueSoonParameter = bind(input.dueSoonUntil.toISOString());
    const expectedKeysParameter = bind(expectedStableKeys);
    const expectedKeyCountParameter = bind(expectedStableKeys.length);
    const businessKeysParameter = bind(stableKeys(readiness.inputBindings.businessChecklistItemIds));
    const ownershipKeysParameter = bind(stableKeys(readiness.inputBindings.ownershipChecklistItemIds));
    const estimateKeysParameter = bind(stableKeys(
      policy.items.filter((item) => item.requiredForEstimate).map((item) => item.id),
    ));
    const excludedStatusParameter = bind(readiness.excludedChecklistStatus);
    const partialStatus = Object.entries(readiness.checklistStatusValue)
      .find(([, value]) => value > 0 && value < 1);
    if (!partialStatus) throw new TypeError('Readiness policy has no partial checklist status.');
    const partialStatusParameter = bind(partialStatus[0]);
    const partialValueParameter = bind(partialStatus[1]);
    const resolvedStatusesParameter = bind(readiness.resolvedFollowUpStatuses);
    const searchParameter = bind(search);
    const preparationStatesParameter = bind(input.query.preparationStates ?? []);
    const urgenciesParameter = bind(input.query.urgencies ?? []);
    const projectIdsParameter = bind(input.projectIds);
    const includeArchivedParameter = bind(input.includeArchived);
    const cursorUrgencyParameter = cursor ? bind(cursor.anchor.urgency) : '';
    const cursorDueAtParameter = cursor ? bind(cursor.anchor.dueAt) : '';
    const cursorNameParameter = cursor ? bind(cursor.anchor.projectName) : '';
    const cursorIdParameter = cursor ? bind(cursor.anchor.projectId) : '';
    const baseInfoFraction = projectFieldFraction(
      readiness.inputBindings.baseInfoProjectFields,
    );
    const ownershipFieldFraction = projectFieldFraction(
      readiness.inputBindings.ownershipProjectFields,
    );

    const rows = await this.dataSource.query<RawQueuePage[]>(`
      WITH /* project_work_state_projection project_work_state_page */
      current_round AS MATERIALIZED (
        SELECT DISTINCT ON (round.project_id)
               round.project_id,
               round.id,
               round.status,
               round.created_at
          FROM interview_rounds round
         WHERE round.type = 'INITIAL_INTAKE'
           AND round.status IN ('OPEN', 'ENDED')
         ORDER BY round.project_id, round.created_at DESC, round.id ASC
      ),
      latest_restoration AS MATERIALIZED (
        SELECT event.project_id, MAX(event.created_at) AS created_at
          FROM audit_events event
         WHERE event.event_type = 'PROJECT_RESTORED'
         GROUP BY event.project_id
      ),
      reply_counts AS MATERIALIZED (
        SELECT correspondence.project_id,
               COUNT(*) FILTER (WHERE correspondence.status = 'Új válasz')::integer AS new_reply_count
          FROM customer_correspondences correspondence
         GROUP BY correspondence.project_id
      ),
      assessment AS MATERIALIZED (
        SELECT snapshot.round_id,
               snapshot.stable_key,
               snapshot.blocking,
               answer.id AS answer_id,
               CASE
                 WHEN assessment_override.status = ${excludedStatusParameter} THEN NULL
                 WHEN assessment_override.status = ${partialStatusParameter} THEN ${partialValueParameter}::numeric
                 WHEN answer.id IS NOT NULL
                   AND is_valid_round_answer(snapshot.type, snapshot.options, answer.value)
                   THEN 1::numeric
                 ELSE 0::numeric
               END AS checklist_value
          FROM round_question_snapshots snapshot
          LEFT JOIN round_answers answer
            ON answer.round_id = snapshot.round_id
           AND answer.snapshot_id = snapshot.id
          LEFT JOIN round_question_assessment_overrides assessment_override
            ON assessment_override.round_id = snapshot.round_id
           AND assessment_override.snapshot_id = snapshot.id
      ),
      round_metrics AS MATERIALIZED (
        SELECT current_round.project_id,
               COUNT(assessment.stable_key)::integer AS snapshot_count,
               COUNT(assessment.stable_key) FILTER (
                 WHERE assessment.stable_key = ANY(${expectedKeysParameter}::text[])
               )::integer AS canonical_snapshot_count,
               COUNT(assessment.answer_id)::integer AS answered_questions,
               COALESCE(AVG(assessment.checklist_value), 0)::numeric AS checklist_fraction,
               COALESCE(AVG(assessment.checklist_value) FILTER (
                 WHERE assessment.stable_key = ANY(${businessKeysParameter}::text[])
               ), 0)::numeric AS business_fraction,
               COALESCE(AVG(assessment.checklist_value) FILTER (
                 WHERE assessment.stable_key = ANY(${ownershipKeysParameter}::text[])
               ), 0)::numeric AS ownership_checklist_fraction,
               COALESCE(BOOL_AND(assessment.checklist_value IS NULL) FILTER (
                 WHERE assessment.stable_key = ANY(${ownershipKeysParameter}::text[])
               ), false) AS ownership_checklist_excluded,
               COALESCE(BOOL_OR(
                 assessment.checklist_value = 0 AND assessment.blocking
               ), false) AS has_critical_gap,
               COUNT(*) FILTER (
                 WHERE assessment.stable_key = ANY(${estimateKeysParameter}::text[])
                   AND assessment.checklist_value IS NOT NULL
                   AND assessment.checklist_value < 1
               )::integer AS estimate_blocking_gap_count
          FROM current_round
          LEFT JOIN assessment ON assessment.round_id = current_round.id
         GROUP BY current_round.project_id
      ),
      follow_up_metrics AS MATERIALIZED (
        SELECT follow_up.project_id,
               COUNT(*)::integer AS total_follow_ups,
               COUNT(*) FILTER (
                 WHERE follow_up.status = ANY(${resolvedStatusesParameter}::text[])
               )::integer AS resolved_follow_ups
          FROM discovery_follow_ups follow_up
         GROUP BY follow_up.project_id
      ),
      project AS MATERIALIZED (
        SELECT source.*,
               ${normalizedProjectNameSql.replaceAll('project.', 'source.')} AS normalized_project_name,
               COALESCE(reply_counts.new_reply_count, 0)::integer AS new_reply_count,
               current_round.id AS current_round_id,
               current_round.status AS current_round_status,
               current_round.created_at AS current_round_created_at,
               latest_restoration.created_at AS latest_restoration_at,
               EXISTS (
                 SELECT 1 FROM project_question_schemas schema WHERE schema.project_id = source.id
               ) AS has_schema,
               COALESCE(round_metrics.snapshot_count, 0)::integer AS total_questions,
               COALESCE(round_metrics.canonical_snapshot_count, 0)::integer AS canonical_snapshot_count,
               COALESCE(round_metrics.answered_questions, 0)::integer AS answered_questions,
               COALESCE(round_metrics.checklist_fraction, 0)::numeric AS checklist_fraction,
               COALESCE(round_metrics.business_fraction, 0)::numeric AS business_fraction,
               COALESCE(round_metrics.ownership_checklist_fraction, 0)::numeric AS ownership_checklist_fraction,
               COALESCE(round_metrics.ownership_checklist_excluded, false) AS ownership_checklist_excluded,
               COALESCE(round_metrics.has_critical_gap, false) AS has_critical_gap,
               COALESCE(round_metrics.estimate_blocking_gap_count, 0)::integer AS estimate_blocking_gap_count,
               COALESCE(follow_up_metrics.total_follow_ups, 0)::integer AS total_follow_ups,
               COALESCE(follow_up_metrics.resolved_follow_ups, 0)::integer AS resolved_follow_ups,
               num_nonnulls(
                 source.business_value_rating,
                 source.strategic_alignment_rating,
                 source.urgency_rating,
                 source.confidence_rating,
                 source.complexity_rating,
                 source.risk_rating
               )::integer AS completed_decision_inputs
          FROM projects source
          LEFT JOIN current_round ON current_round.project_id = source.id
          LEFT JOIN latest_restoration ON latest_restoration.project_id = source.id
          LEFT JOIN reply_counts ON reply_counts.project_id = source.id
          LEFT JOIN round_metrics ON round_metrics.project_id = source.id
          LEFT JOIN follow_up_metrics ON follow_up_metrics.project_id = source.id
         WHERE (${includeArchivedParameter}::boolean OR source.status <> 'ARCHIVED')
           AND (
             ${projectIdsParameter}::uuid[] IS NULL
             OR source.id = ANY(${projectIdsParameter}::uuid[])
           )
      ),
      readiness_facts AS MATERIALIZED (
        SELECT project.*,
               ROUND((
                 (${baseInfoFraction}) * ${bind(readiness.weights.baseInfo)}::numeric
                 + project.business_fraction * ${bind(readiness.weights.business)}::numeric
                 + CASE
                     WHEN project.ownership_checklist_excluded THEN 0
                     ELSE ((${ownershipFieldFraction}) + project.ownership_checklist_fraction) / 2
                   END * ${bind(readiness.weights.ownership)}::numeric
                 + project.checklist_fraction * ${bind(readiness.weights.checklist)}::numeric
                 + CASE
                     WHEN project.total_follow_ups = 0 THEN 1
                     ELSE project.resolved_follow_ups::numeric / project.total_follow_ups
                   END * ${bind(readiness.weights.followUpResolution)}::numeric
               ) * 100)::integer AS readiness_percentage
          FROM project
      ),
      decision_facts AS MATERIALIZED (
        SELECT readiness_facts.*,
               ROUND(
                 ((business_value_rating - ${bind(decision.scale.minimum)} + 1) * ${bind(decision.scale.percentageStep)}) * ${bind(decision.weights.businessValue)}::numeric
                 + ((strategic_alignment_rating - ${bind(decision.scale.minimum)} + 1) * ${bind(decision.scale.percentageStep)}) * ${bind(decision.weights.strategicAlignment)}::numeric
                 + ((urgency_rating - ${bind(decision.scale.minimum)} + 1) * ${bind(decision.scale.percentageStep)}) * ${bind(decision.weights.urgency)}::numeric
                 + ((confidence_rating - ${bind(decision.scale.minimum)} + 1) * ${bind(decision.scale.percentageStep)}) * ${bind(decision.weights.confidence)}::numeric
                 + ((${bind(decision.scale.maximum)} - complexity_rating + 1) * ${bind(decision.scale.percentageStep)}) * ${bind(decision.weights.complexity)}::numeric
                 + ((${bind(decision.scale.maximum)} - risk_rating + 1) * ${bind(decision.scale.percentageStep)}) * ${bind(decision.weights.risk)}::numeric
                 + readiness_percentage * ${bind(decision.weights.readiness)}::numeric
               )::integer AS decision_score
          FROM readiness_facts
      ),
      work_state AS MATERIALIZED (
        SELECT decision_facts.id AS project_id,
               decision_facts.name AS project_name,
               decision_facts.customer_contact_name,
               decision_facts.internal_owner_name,
               decision_facts.next_action_owner_role,
               decision_facts.next_action,
               decision_facts.due_date AS due_at,
               decision_facts.normalized_project_name,
               decision_facts.new_reply_count,
               decision_facts.answered_questions,
               decision_facts.total_questions,
               decision_facts.completed_decision_inputs,
               CASE
                 WHEN decision_facts.new_reply_count > 0 THEN 'CUSTOMER_REPLY'
                 WHEN decision_facts.due_date < ${nowParameter}::timestamptz THEN 'OVERDUE'
                 WHEN decision_facts.due_date <= ${dueSoonParameter}::timestamptz THEN 'DUE_SOON'
                 ELSE 'IN_PROGRESS'
               END AS urgency,
               CASE
                 WHEN decision_facts.new_reply_count > 0 THEN 0
                 WHEN decision_facts.due_date < ${nowParameter}::timestamptz THEN 1
                 WHEN decision_facts.due_date <= ${dueSoonParameter}::timestamptz THEN 2
                 ELSE 3
               END AS urgency_rank,
               CASE
                 WHEN NOT decision_facts.has_schema THEN 'SCHEMA_REQUIRED'
                 WHEN decision_facts.latest_restoration_at IS NOT NULL
                   AND (
                     decision_facts.current_round_created_at IS NULL
                     OR decision_facts.current_round_created_at <= decision_facts.latest_restoration_at
                   ) THEN 'SCHEMA_REQUIRED'
                 WHEN decision_facts.current_round_id IS NULL
                   OR decision_facts.current_round_status = 'OPEN' THEN 'INTAKE_IN_PROGRESS'
                 WHEN decision_facts.total_questions <> ${expectedKeyCountParameter}::integer
                   OR decision_facts.canonical_snapshot_count <> ${expectedKeyCountParameter}::integer
                   THEN 'CLARIFICATION_REQUIRED'
                 WHEN decision_facts.completed_decision_inputs < 6 THEN 'DECISION_REVIEW_REQUIRED'
                 WHEN (${bind(decision.clarificationRules.criticalGap)}::boolean AND decision_facts.has_critical_gap)
                   OR decision_facts.readiness_percentage < ${bind(decision.clarificationRules.readinessBelow)}::integer
                   OR decision_facts.estimate_blocking_gap_count > ${bind(decision.clarificationRules.estimateBlockingGapsAbove)}::integer
                   OR decision_facts.readiness_percentage < ${bind(decision.conditionalEstimateRules.readinessAtLeast)}::integer
                   OR decision_facts.decision_score < ${bind(decision.conditionalEstimateRules.decisionScoreAtLeast)}::integer
                   THEN 'CLARIFICATION_REQUIRED'
                 WHEN decision_facts.decision_score >= ${bind(decision.estimateReadyRules.decisionScoreAtLeast)}::integer
                   AND decision_facts.readiness_percentage >= ${bind(decision.estimateReadyRules.readinessAtLeast)}::integer
                   AND decision_facts.estimate_blocking_gap_count = ${bind(decision.estimateReadyRules.estimateBlockingGaps)}::integer
                   THEN 'ESTIMATE_READY'
                 ELSE 'ESTIMATE_PREPARABLE'
               END AS preparation_state
          FROM decision_facts
      ),
      searched AS MATERIALIZED (
        SELECT *
          FROM work_state
         WHERE (${searchParameter}::text = '' OR normalized_project_name LIKE '%' || ${searchParameter}::text || '%')
           AND (
             cardinality(${preparationStatesParameter}::text[]) = 0
             OR preparation_state = ANY(${preparationStatesParameter}::text[])
           )
      ),
      filtered AS MATERIALIZED (
        SELECT *
          FROM searched
         WHERE cardinality(${urgenciesParameter}::text[]) = 0
            OR urgency = ANY(${urgenciesParameter}::text[])
      ),
      page_candidates AS (
        SELECT *
          FROM filtered
         WHERE ${cursor ? `(
           urgency_rank,
           ${orderedDueAtSql},
           normalized_project_name,
           project_id::text
         ) ${cursorComparison} (
           CASE ${cursorUrgencyParameter}::text
             WHEN 'CUSTOMER_REPLY' THEN 0
             WHEN 'OVERDUE' THEN 1
             WHEN 'DUE_SOON' THEN 2
             ELSE 3
           END,
           COALESCE(${cursorDueAtParameter}::timestamptz, 'infinity'::timestamptz),
           ${cursorNameParameter}::text,
           ${cursorIdParameter}::text
         )` : 'true'}
         ORDER BY urgency_rank ${orderDirection},
                  due_at ${orderDirection} NULLS ${direction === 'PREVIOUS' ? 'FIRST' : 'LAST'},
                  normalized_project_name ${orderDirection},
                  project_id ${orderDirection}
         ${input.boundedPage ? 'LIMIT 11' : ''}
      )
      SELECT COALESCE((
               SELECT jsonb_agg(to_jsonb(page_candidates) ORDER BY
                 urgency_rank ${orderDirection},
                 due_at ${orderDirection} NULLS ${direction === 'PREVIOUS' ? 'FIRST' : 'LAST'},
                 normalized_project_name ${orderDirection},
                 project_id ${orderDirection})
                 FROM page_candidates
             ), '[]'::jsonb) AS items,
             (SELECT COUNT(*)::integer FROM filtered) AS total_count,
             (SELECT COUNT(*)::integer FROM searched WHERE urgency = 'CUSTOMER_REPLY') AS customer_reply_count,
             (SELECT COUNT(*)::integer FROM searched WHERE urgency = 'OVERDUE') AS overdue_count,
             (SELECT COUNT(*)::integer FROM searched WHERE urgency = 'DUE_SOON') AS due_soon_count,
             (SELECT COUNT(*)::integer FROM searched WHERE urgency = 'IN_PROGRESS') AS in_progress_count,
             ${cursor ? `EXISTS (
               SELECT 1 FROM filtered
                WHERE urgency = ${cursorUrgencyParameter}::text
                  AND due_at IS NOT DISTINCT FROM ${cursorDueAtParameter}::timestamptz
                  AND normalized_project_name = ${cursorNameParameter}::text
                  AND project_id = ${cursorIdParameter}::uuid
             )` : 'true'} AS anchor_exists
    `, parameters);
    const page = rows[0];
    if (!page) throw new TypeError('Project work-state read model returned no metadata row.');
    return {
      rows: page.items.map(toReadRow),
      totalCount: Number(page.total_count),
      groupCounts: {
        CUSTOMER_REPLY: Number(page.customer_reply_count),
        OVERDUE: Number(page.overdue_count),
        DUE_SOON: Number(page.due_soon_count),
        IN_PROGRESS: Number(page.in_progress_count),
      },
      anchorExists: page.anchor_exists,
    };
  }
}

function toReadRow(row: RawQueueRow): ProjectWorkStateReadRow {
  return {
    projectId: row.project_id,
    projectName: row.project_name,
    customerContactName: row.customer_contact_name,
    internalOwnerName: row.internal_owner_name,
    nextActionOwnerRole: row.next_action_owner_role,
    nextAction: row.next_action,
    dueAt: row.due_at === null ? null : new Date(row.due_at).toISOString(),
    urgency: row.urgency,
    newReplyCount: Number(row.new_reply_count),
    preparationState: row.preparation_state,
    answeredQuestions: Number(row.answered_questions),
    totalQuestions: Number(row.total_questions),
    completedDecisionInputs: Number(row.completed_decision_inputs),
  };
}

function projectFieldFraction(fields: readonly string[]): string {
  const expressions: Readonly<Record<string, string>> = {
    name: `CASE WHEN btrim(project.name) <> '' THEN 1 ELSE 0 END`,
    customerContactName: `CASE WHEN btrim(project.customer_contact_name) <> '' THEN 1 ELSE 0 END`,
    customerContactEmail: `CASE WHEN btrim(project.customer_contact_email) <> '' THEN 1 ELSE 0 END`,
    ballOwner: `CASE WHEN project.ball_owner IS NOT NULL AND btrim(project.ball_owner) <> '' THEN 1 ELSE 0 END`,
  };
  if (fields.length === 0) throw new TypeError('Readiness policy has no bound Project fields.');
  const selected = fields.map((field) => {
    const expression = expressions[field];
    if (!expression) throw new TypeError(`Unsupported readiness Project field ${field}.`);
    return expression;
  });
  return `((${selected.join(' + ')})::numeric / ${fields.length})`;
}

function normalizeProjectName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('hu-HU');
}
