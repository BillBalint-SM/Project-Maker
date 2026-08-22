import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  DeliveryHandoff,
  DeliveryHandoffPreview,
  DeliveryPackage,
  DeliveryPackageItemInput,
  GitSetup,
  MarkdownRevision,
  SaveDeliveryPackageInput,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { forkJoin } from 'rxjs';

import { MarkdownApiService } from '../../markdown/markdown-api.service';
import { ProjectApiService } from '../project-api.service';
import { DeliveryApiService } from './delivery-api.service';

type ItemForm = FormGroup<{
  id: FormControl<string>;
  title: FormControl<string>;
  userStory: FormControl<string>;
  acceptanceCriteria: FormArray<FormControl<string>>;
  sourceExcerpts: FormArray<FormControl<string>>;
}>;

@Component({
  selector: 'app-delivery-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    TagModule,
    TextareaModule,
  ],
  templateUrl: './delivery.page.html',
  styleUrl: './delivery.page.scss',
})
export class DeliveryPage implements OnInit {
  private readonly api = inject(DeliveryApiService);
  private readonly markdown = inject(MarkdownApiService);
  private readonly projects = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly revisions = signal<readonly MarkdownRevision[]>([]);
  readonly deliveryPackage = signal<DeliveryPackage | null>(null);
  readonly gitSetups = signal<readonly GitSetup[]>([]);
  readonly handoffs = signal<readonly DeliveryHandoff[]>([]);
  readonly preview = signal<DeliveryHandoffPreview | null>(null);
  readonly archived = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly handoffPending = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);

  readonly packageForm = new FormGroup({
    specificationRevisionId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    items: new FormArray<ItemForm>([]),
  });
  readonly selectedGitSetupId = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.packageForm.controls.specificationRevisionId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.preview.set(null);
      });
    this.load();
  }

  load(): void {
    if (!this.projectId) {
      this.error.set('The project identifier is missing.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      project: this.projects.loadProjectWorkspace(this.projectId),
      revisions: this.markdown.listRevisions(this.projectId),
      deliveryPackage: this.api.loadPackage(this.projectId),
      gitSetups: this.api.listGitSetups(),
      handoffs: this.api.listHandoffs(this.projectId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (view) => {
        this.archived.set(view.project.status === 'ARCHIVED');
        this.revisions.set([...view.revisions].sort((left, right) => right.version - left.version));
        this.deliveryPackage.set(view.deliveryPackage);
        this.gitSetups.set(view.gitSetups);
        this.handoffs.set(view.handoffs);
        const revisionId = view.deliveryPackage?.specification.id ?? view.revisions[0]?.id ?? '';
        this.packageForm.controls.specificationRevisionId.setValue(revisionId);
        this.replaceItems(view.deliveryPackage?.items ?? [emptyItem()]);
        this.packageForm.markAsPristine();
        if (view.project.status === 'ARCHIVED') this.packageForm.disable({ emitEvent: false });
        else this.packageForm.enable({ emitEvent: false });
        const currentSetupId = this.selectedGitSetupId.value;
        if (!view.gitSetups.some((setup) => setup.id === currentSetupId)) {
          this.selectedGitSetupId.setValue(view.gitSetups[0]?.id ?? '');
        }
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  addItem(item: DeliveryPackageItemInput = emptyItem()): void {
    this.packageForm.controls.items.push(createItemForm(item));
  }

  removeItem(index: number): void {
    if (this.packageForm.controls.items.length <= 1) return;
    this.packageForm.controls.items.removeAt(index);
  }

  addCriterion(itemIndex: number): void {
    this.itemAt(itemIndex).controls.acceptanceCriteria.push(textControl(''));
  }

  removeCriterion(itemIndex: number, criterionIndex: number): void {
    const criteria = this.itemAt(itemIndex).controls.acceptanceCriteria;
    if (criteria.length <= 1) return;
    criteria.removeAt(criterionIndex);
  }

  addSourceExcerpt(itemIndex: number): void {
    this.itemAt(itemIndex).controls.sourceExcerpts.push(textControl('', 2_000, false));
  }

  removeSourceExcerpt(itemIndex: number, sourceIndex: number): void {
    this.itemAt(itemIndex).controls.sourceExcerpts.removeAt(sourceIndex);
  }

  itemAt(index: number): ItemForm {
    return this.packageForm.controls.items.at(index);
  }

  savePackage(): void {
    this.packageForm.markAllAsTouched();
    if (this.packageForm.invalid || this.saving() || this.archived()) {
      if (this.packageForm.invalid) this.error.set('Provide an item title, user story, and at least one acceptance criterion for each item.');
      return;
    }
    const raw = this.packageForm.getRawValue();
    const input: SaveDeliveryPackageInput = {
      specificationRevisionId: raw.specificationRevisionId,
      items: raw.items.map((item) => ({
        id: item.id || undefined,
        title: item.title.trim(),
        userStory: item.userStory.trim(),
        acceptanceCriteria: item.acceptanceCriteria.map((criterion) => criterion.trim()).filter(Boolean),
        sourceExcerpts: item.sourceExcerpts.map((excerpt) => excerpt.trim()).filter(Boolean),
      })),
    };
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.savePackage(this.projectId, input).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.deliveryPackage.set(saved);
        this.replaceItems(saved.items);
        this.packageForm.markAsPristine();
        this.saving.set(false);
        this.preview.set(null);
        this.feedback.set(`Delivery Package v${saved.version} has been saved.`);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.saving.set(false);
      },
    });
  }

  createHandoffPreview(): void {
    const setupId = this.selectedGitSetupId.value;
    if (!setupId || !this.deliveryPackage() || this.packageForm.dirty || this.handoffPending() || this.archived()) return;
    this.handoffPending.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.previewHandoff(this.projectId, setupId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.handoffPending.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.handoffPending.set(false);
      },
    });
  }

  confirmHandoff(): void {
    const preview = this.preview();
    if (!preview || this.handoffPending() || this.archived()) return;
    this.handoffPending.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.confirmHandoff(this.projectId, preview.previewToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (handoff) => {
          this.preview.set(null);
          this.handoffPending.set(false);
          this.feedback.set(handoff.state === 'SENT'
            ? `The Delivery Package has been handed off to Git (${shortSha(handoff.commitSha)}).`
            : 'The Git handoff could not be verified. Retry it from the history.');
          this.loadAfterHandoff();
        },
        error: (error: Error) => {
          this.error.set(error.message);
          this.handoffPending.set(false);
        },
      });
  }

  retryHandoff(handoff: DeliveryHandoff): void {
    if (this.handoffPending() || this.archived()) return;
    this.handoffPending.set(true);
    this.error.set(null);
    this.api.retryHandoff(this.projectId, handoff.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.handoffPending.set(false);
        this.feedback.set(result.state === 'SENT' ? 'The Git handoff completed successfully.' : 'The Git handoff still cannot be verified.');
        this.loadAfterHandoff();
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.handoffPending.set(false);
      },
    });
  }

  markdownExportUrl(): string { return this.api.markdownExportUrl(this.projectId); }
  csvExportUrl(): string { return this.api.csvExportUrl(this.projectId); }
  printUrl(): string { return this.api.printUrl(this.projectId); }
  shortSha(value: string | null): string { return shortSha(value); }

  handoffLabel(handoff: DeliveryHandoff): string {
    const labels: Record<DeliveryHandoff['state'], string> = {
      PENDING: 'Prepared', PUSHING: 'Pushing', SENT: 'Handed off', FAILED: 'Failed', CONFLICT: 'Git conflict',
    };
    return labels[handoff.state];
  }

  private replaceItems(items: readonly DeliveryPackageItemInput[]): void {
    const array = this.packageForm.controls.items;
    array.clear({ emitEvent: false });
    for (const item of items) array.push(createItemForm(item), { emitEvent: false });
  }

  private loadAfterHandoff(): void {
    forkJoin({
      deliveryPackage: this.api.loadPackage(this.projectId),
      handoffs: this.api.listHandoffs(this.projectId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (view) => {
        this.deliveryPackage.set(view.deliveryPackage);
        this.handoffs.set(view.handoffs);
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }
}

function createItemForm(item: DeliveryPackageItemInput): ItemForm {
  return new FormGroup({
    id: new FormControl(item.id ?? '', { nonNullable: true }),
    title: textControl(item.title, 255),
    userStory: textControl(item.userStory, 4_000),
    acceptanceCriteria: new FormArray(
      (item.acceptanceCriteria.length ? item.acceptanceCriteria : ['']).map((value) => textControl(value, 4_000)),
    ),
    sourceExcerpts: new FormArray(
      (item.sourceExcerpts ?? []).map((value) => textControl(value, 2_000, false)),
    ),
  });
}

function textControl(value: string, maxLength = 4_000, required = true): FormControl<string> {
  return new FormControl(value, {
    nonNullable: true,
    validators: required ? [Validators.required, Validators.maxLength(maxLength)] : [Validators.maxLength(maxLength)],
  });
}

function emptyItem(): DeliveryPackageItemInput {
  return { title: '', userStory: '', acceptanceCriteria: [''], sourceExcerpts: [] };
}

function shortSha(value: string | null): string {
  return value ? value.slice(0, 10) : 'No SHA';
}
