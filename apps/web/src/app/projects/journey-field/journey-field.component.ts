import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  PortfolioRow,
  ProjectPreparationState,
  ProjectWorkState,
} from '@project-maker/contracts';

import { projectActionFragment, projectActionRoute } from '../project-action-route';
import { projectWorkProgressLabel } from '../project-work-progress-label';

interface JourneyStageDefinition {
  readonly state: ProjectPreparationState;
  readonly label: string;
  readonly shortLabel: string;
}

type JourneyEntry = PortfolioRow & { readonly workState: ProjectWorkState };

interface JourneyStage extends JourneyStageDefinition {
  readonly items: readonly JourneyEntry[];
  readonly visibleItems: readonly JourneyEntry[];
}

const stageDefinitions: readonly JourneyStageDefinition[] = [
  { state: 'SCHEMA_REQUIRED', label: 'Question schema required', shortLabel: 'Define questions' },
  { state: 'INTAKE_IN_PROGRESS', label: 'Initial Intake in progress', shortLabel: 'Gather context' },
  { state: 'CLARIFICATION_REQUIRED', label: 'Clarification required', shortLabel: 'Resolve gaps' },
  { state: 'DECISION_REVIEW_REQUIRED', label: 'Decision Review required', shortLabel: 'Review decision' },
  { state: 'ESTIMATE_PREPARABLE', label: 'Ready for estimate preparation', shortLabel: 'Prepare estimate' },
  { state: 'ESTIMATE_READY', label: 'Ready for estimation', shortLabel: 'Estimate ready' },
];

@Component({
  selector: 'app-journey-field',
  imports: [DatePipe, RouterLink],
  templateUrl: './journey-field.component.html',
  styleUrl: './journey-field.component.scss',
})
export class JourneyFieldComponent {
  readonly entries = input.required<readonly PortfolioRow[]>();
  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly totalCount = input.required<number>();

  readonly selectedProjectId = signal<string | null>(null);
  readonly locatedEntries = computed(() => this.entries().filter(hasWorkState));
  readonly unlocatedCount = computed(() => this.entries().length - this.locatedEntries().length);
  readonly stages = computed<readonly JourneyStage[]>(() =>
    stageDefinitions.map((stage) => {
      const items = this.locatedEntries().filter(
        (entry) => entry.workState.preparationStatus.state === stage.state,
      );
      return { ...stage, items, visibleItems: items.slice(0, 4) };
    }),
  );
  readonly selectedEntry = computed<JourneyEntry | null>(() => {
    const entries = this.locatedEntries();
    return entries.find((entry) => entry.project.id === this.selectedProjectId())
      ?? entries[0]
      ?? null;
  });

  readonly progressLabel = projectWorkProgressLabel;

  selectProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  projectRoute(entry: JourneyEntry): readonly string[] {
    return projectActionRoute(entry.project.id, entry.workState.primaryAction.target);
  }

  actionFragment(entry: JourneyEntry): string | undefined {
    return projectActionFragment(entry.workState.primaryAction.target);
  }

  queueQueryParams(state: ProjectPreparationState): { readonly preparation: ProjectPreparationState } {
    return { preparation: state };
  }
}

function hasWorkState(entry: PortfolioRow): entry is JourneyEntry {
  return entry.workState !== null;
}
