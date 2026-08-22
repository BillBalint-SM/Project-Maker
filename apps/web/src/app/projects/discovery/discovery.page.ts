import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import type {
  Insight,
  InterviewRound,
  InterviewRoundType,
  ProjectContact,
  ProjectQuestionSchema,
} from '@project-maker/contracts';

import { InterviewApiService } from '../../interviews/interview-api.service';
import { QuestionBankApiService } from '../../settings/question-bank-api.service';
import { ProjectApiService } from '../project-api.service';
import { DiscoveryApiService } from './discovery-api.service';

interface AnswerSourceOption {
  readonly key: string;
  readonly roundId: string;
  readonly snapshotId: string;
  readonly label: string;
}

@Component({
  selector: 'app-discovery-page',
  imports: [
    ButtonModule,
    CardModule,
    FormsModule,
    MessageModule,
    ProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './discovery.page.html',
  styleUrl: './discovery.page.scss',
})
export class DiscoveryPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly discovery = inject(DiscoveryApiService);
  private readonly interviews = inject(InterviewApiService);
  private readonly questions = inject(QuestionBankApiService);
  private readonly projects = inject(ProjectApiService);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly contacts = signal<readonly ProjectContact[]>([]);
  readonly rounds = signal<readonly InterviewRound[]>([]);
  readonly insights = signal<readonly Insight[]>([]);
  readonly schema = signal<ProjectQuestionSchema | null>(null);
  readonly archived = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);

  contactId: string | null = null;
  contactName = '';
  contactEmail = '';
  contactPhone = '';
  contactNote = '';

  roundType: Exclude<InterviewRoundType, 'INITIAL_INTAKE'> = 'STAKEHOLDER';
  roundStableKey = '';
  adHocTopic = '';
  adHocQuestion = '';

  insightId: string | null = null;
  insightVersion = 0;
  insightStatement = '';
  insightAnswerSource = '';
  insightEvidenceId = '';
  insightEditEvidenceIds: readonly string[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.projectId) {
      this.error.set('Hiányzik a projekt azonosítója.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      project: this.projects.loadProjectWorkspace(this.projectId),
      contacts: this.discovery.listContacts(this.projectId),
      rounds: this.interviews.listRounds(this.projectId),
      insights: this.discovery.listInsights(this.projectId),
      schema: this.questions.loadProjectSchema(this.projectId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (view) => {
        this.archived.set(view.project.status === 'ARCHIVED');
        this.contacts.set(view.contacts);
        this.rounds.set(view.rounds);
        this.insights.set(view.insights);
        this.schema.set(view.schema);
        this.roundStableKey ||= view.schema?.questions[0]?.stableKey ?? '';
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  saveContact(): void {
    if (this.saving() || this.archived() || !this.contactName.trim()) return;
    this.startSave();
    const input = {
      name: this.contactName.trim(),
      email: nullable(this.contactEmail),
      phone: nullable(this.contactPhone),
      note: nullable(this.contactNote),
    };
    const request = this.contactId
      ? this.discovery.updateContact(this.projectId, this.contactId, input)
      : this.discovery.createContact(this.projectId, input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.resetContact();
        this.finishSave('A projektkapcsolat mentve lett.');
      },
      error: (error: Error) => this.failSave(error),
    });
  }

  editContact(contact: ProjectContact): void {
    this.contactId = contact.id;
    this.contactName = contact.name;
    this.contactEmail = contact.email ?? '';
    this.contactPhone = contact.phone ?? '';
    this.contactNote = contact.note ?? '';
  }

  deleteContact(contactId: string): void {
    if (this.saving() || this.archived() || !confirm('Törlöd ezt a projektkapcsolatot?')) return;
    this.startSave();
    this.discovery.deleteContact(this.projectId, contactId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.finishSave('A projektkapcsolat törölve lett.'),
        error: (error: Error) => this.failSave(error),
      });
  }

  startRound(): void {
    const selectedStableKeys = this.roundStableKey ? [this.roundStableKey] : undefined;
    const adHocQuestions = this.roundType === 'CLARIFICATION' && this.adHocQuestion.trim()
      ? [{ text: this.adHocQuestion.trim(), topic: this.adHocTopic.trim() || 'Tisztázás' }]
      : undefined;
    if (this.saving() || this.archived() || (!selectedStableKeys && !adHocQuestions)) return;
    this.startSave();
    this.interviews.createRound(this.projectId, {
      type: this.roundType,
      selectedStableKeys,
      adHocQuestions,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (round) => {
        this.saving.set(false);
        void this.router.navigate(
          ['/projects', this.projectId, 'interview'],
          { queryParams: { roundId: round.id, returnTo: `/projects/${this.projectId}/discovery` } },
        );
      },
      error: (error: Error) => this.failSave(error),
    });
  }

  answerSources(): readonly AnswerSourceOption[] {
    return this.rounds().flatMap((round) => round.questions
      .filter((question) => question.answer !== null)
      .map((question) => ({
        key: `${round.id}:${question.id}`,
        roundId: round.id,
        snapshotId: question.id,
        label: `${roundLabel(round.type)} · ${question.text}`,
      })));
  }

  reusableEvidence(): readonly Insight['evidence'][number][] {
    return [...new Map(
      this.insights().flatMap((insight) => insight.evidence).map((evidence) => [evidence.id, evidence]),
    ).values()];
  }

  saveInsight(): void {
    if (this.saving() || this.archived() || !this.insightStatement.trim()) return;
    this.startSave();
    if (this.insightId) {
      this.discovery.updateInsight(this.projectId, this.insightId, {
        expectedVersion: this.insightVersion,
        statement: this.insightStatement.trim(),
        evidenceIds: this.insightEditEvidenceIds,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.resetInsight();
          this.finishSave('Az insight frissítve lett.');
        },
        error: (error: Error) => this.failSave(error),
      });
      return;
    }
    const answerSource = this.answerSources().find((source) => source.key === this.insightAnswerSource);
    const input = this.insightEvidenceId
      ? { statement: this.insightStatement.trim(), evidenceIds: [this.insightEvidenceId] }
      : answerSource
        ? {
            statement: this.insightStatement.trim(),
            sources: [{
              kind: 'ROUND_ANSWER' as const,
              roundId: answerSource.roundId,
              snapshotId: answerSource.snapshotId,
            }],
          }
        : null;
    if (!input) {
      this.failSave(new Error('Válassz mentett választ vagy meglévő bizonyítékforrást.'));
      return;
    }
    this.discovery.createInsight(this.projectId, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resetInsight();
          this.finishSave('A bizonyítékalapú insight mentve lett.');
        },
        error: (error: Error) => this.failSave(error),
      });
  }

  editInsight(insight: Insight): void {
    this.insightId = insight.id;
    this.insightVersion = insight.version;
    this.insightStatement = insight.statement;
    this.insightEditEvidenceIds = insight.evidence.map((evidence) => evidence.id);
  }

  roundLabel(type: InterviewRoundType): string {
    return roundLabel(type);
  }

  private startSave(): void {
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
  }

  private finishSave(message: string): void {
    this.saving.set(false);
    this.feedback.set(message);
    this.load();
  }

  private failSave(error: Error): void {
    this.saving.set(false);
    this.error.set(error.message);
  }

  private resetContact(): void {
    this.contactId = null;
    this.contactName = '';
    this.contactEmail = '';
    this.contactPhone = '';
    this.contactNote = '';
  }

  private resetInsight(): void {
    this.insightId = null;
    this.insightVersion = 0;
    this.insightStatement = '';
    this.insightAnswerSource = '';
    this.insightEvidenceId = '';
    this.insightEditEvidenceIds = [];
  }
}

function nullable(value: string): string | null {
  return value.trim() || null;
}

function roundLabel(type: InterviewRoundType): string {
  if (type === 'STAKEHOLDER') return 'Stakeholder kör';
  if (type === 'CLARIFICATION') return 'Tisztázó kör';
  return 'Kezdő felmérés';
}
