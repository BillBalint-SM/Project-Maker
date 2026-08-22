import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { PackagedPlaybookSummary, ProjectStatus, ProjectWorkspace } from '@project-maker/contracts';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { finalize } from 'rxjs';

import { ProjectCommandPending } from './project-command-pending';
import { CustomerFollowUpComponent } from './customer-follow-up/customer-follow-up.component';
import type { ProjectSettingsView } from './project-api.models';
import { ProjectApiService } from './project-api.service';
import { ProjectContextState } from './project-context/project-context.state';
import { activeProjectStatusOptions, projectStatusLabel } from './project-status-label';

type ActiveProjectStatus = Exclude<ProjectStatus, 'ARCHIVED'>;

@Component({
  selector: 'app-project-settings-page',
  imports: [
    ButtonModule,
    CardModule,
    ConfirmDialog,
    CustomerFollowUpComponent,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    SelectModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './project-settings.page.html',
  styleUrl: './project-settings.page.scss',
})
export class ProjectSettingsPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projectContext = inject(ProjectContextState, { optional: true });
  private lifecycleIntent = 0;
  private appliedLifecycleIntent = 0;
  readonly pending = new ProjectCommandPending();

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly view = signal<ProjectSettingsView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly basicsError = signal<string | null>(null);
  readonly basicsFeedback = signal<string | null>(null);
  readonly lifecycleError = signal<string | null>(null);
  readonly lifecycleFeedback = signal<string | null>(null);
  readonly statusOptions = activeProjectStatusOptions;
  readonly playbooks = signal<readonly PackagedPlaybookSummary[]>([]);
  readonly basicsSaving = computed(() => this.pending.isPending('save-basics'));
  readonly transitioning = computed(() => {
    return this.pending.isPending('archive') || this.pending.isPending('restore');
  });
  readonly deleting = computed(
    () => this.pending.isPending('delete'),
  );
  readonly lifecycleSaving = computed(
    () => this.pending.isPending('save-status'),
  );

  readonly basicsForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    internalOwnerName: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    customerContactName: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    customerContactEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
  });
  readonly lifecycleForm = new FormGroup({
    status: new FormControl<ActiveProjectStatus>('DRAFT', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  readonly playbookForm = new FormGroup({
    playbook: new FormControl('general:1', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.api.listPlaybooks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (playbooks) => this.playbooks.set(playbooks),
      error: (error: Error) => this.actionError.set(error.message),
    });
    this.loadSettings();
  }

  savePlaybook(): void {
    if (this.isArchived()) return;
    const [playbookId, versionText] = this.playbookForm.controls.playbook.value.split(':');
    if (!playbookId || !this.pending.begin('save-playbook')) return;
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.updateProjectPlaybook(this.projectId, {
      playbookId,
      playbookVersion: Number(versionText),
    }).pipe(
      finalize(() => this.pending.end('save-playbook')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        this.applyProjectPatch(project, { playbook: project.playbook });
        this.playbookForm.reset({
          playbook: `${project.playbook.id}:${project.playbook.version}`,
        });
        this.feedback.set('A projekt playbookja mentve lett.');
      },
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  loadSettings(): void {
    if (!this.projectId) {
      this.loadError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.loadProjectSettings(this.projectId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (view) => {
        this.view.set(view);
        this.resetForms(view.project);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  canEditBasics(): boolean {
    const project = this.view()?.project;
    return project !== undefined && project.status !== 'ARCHIVED';
  }

  saveProjectBasics(): void {
    this.basicsForm.markAllAsTouched();
    if (this.basicsForm.invalid || !this.canEditBasics()) return;

    const value = this.basicsForm.getRawValue();
    if (!this.pending.begin('save-basics')) return;
    this.basicsError.set(null);
    this.basicsFeedback.set(null);
    this.api.updateProjectBasics(this.projectId, {
      name: value.name.trim(),
      internalOwnerName: value.internalOwnerName.trim(),
      customerContactName: value.customerContactName.trim(),
      customerContactEmail: value.customerContactEmail.trim(),
    }).pipe(
      finalize(() => this.pending.end('save-basics')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        this.applyProjectPatch(project, {
          name: project.name,
          internalOwnerName: project.internalOwnerName,
          customerContactName: project.customerContactName,
          customerContactEmail: project.customerContactEmail,
        });
        this.resetBasicsForm(project);
        this.basicsFeedback.set('A projekt alapadatai mentve lettek.');
        this.projectContext?.reload();
      },
      error: (error: Error) => this.basicsError.set(error.message),
    });
  }

  saveProjectStatus(): void {
    this.lifecycleForm.markAllAsTouched();
    if (this.lifecycleForm.invalid || this.isArchived() || this.transitioning()) return;

    if (!this.pending.begin('save-status')) return;
    const intent = ++this.lifecycleIntent;
    this.lifecycleError.set(null);
    this.lifecycleFeedback.set(null);
    this.api.updateWorkspace(this.projectId, {
      status: this.lifecycleForm.controls.status.value,
    }).pipe(
      finalize(() => this.pending.end('save-status')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        if (!this.applyProjectStatus(project, intent)) return;
        this.lifecycleFeedback.set('Az adminisztratív projektfázis frissítve lett.');
        this.projectContext?.reload();
      },
      error: (error: Error) => {
        if (intent >= this.appliedLifecycleIntent) {
          this.lifecycleError.set(error.message);
        }
      },
    });
  }

  requestProjectArchive(): void {
    if (this.isArchived() || this.pending.isPending('archive')) return;
    this.confirmationService.confirm({
      key: 'project-archive',
      header: 'Projekt archiválása',
      message: 'A projekt aktív munkája és automatikus ügyfél-emlékeztetője szünetel. Minden mentett állapot és történet megmarad; visszaállításkor ugyaninnen folytatható, korábbi esemény vagy küldés megismétlése nélkül.',
      defaultFocus: 'none',
      accept: () => this.archiveProject(),
    });
  }

  archiveProject(): void {
    if (this.isArchived() || !this.pending.begin('archive')) return;
    const intent = ++this.lifecycleIntent;
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.archiveProject(this.projectId).pipe(
      finalize(() => this.pending.end('archive')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        if (!this.applyProjectStatus(project, intent)) return;
        this.feedback.set('A projekt archiválva lett.');
        this.projectContext?.reload();
      },
      error: (error: Error) => {
        if (intent >= this.appliedLifecycleIntent) {
          this.actionError.set(error.message);
        }
      },
    });
  }

  restoreProject(): void {
    if (!this.isArchived() || !this.pending.begin('restore')) return;
    const intent = ++this.lifecycleIntent;
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.restoreProject(this.projectId).pipe(
      finalize(() => this.pending.end('restore')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        if (!this.applyProjectStatus(project, intent)) return;
        this.feedback.set(
          `A projekt az archiválás előtti állapotban, az ${projectStatusLabel(project.status)} fázisban folytatható. Korábbi esemény vagy küldés nem ismétlődött meg.`,
        );
        this.projectContext?.reload();
      },
      error: (error: Error) => {
        if (intent >= this.appliedLifecycleIntent) {
          this.actionError.set(error.message);
        }
      },
    });
  }

  requestProjectDeletion(): void {
    if (!this.isDeletableDraft() || this.pending.isPending('delete')) return;
    this.confirmationService.confirm({
      key: 'project-delete',
      header: 'Projekt végleges törlése',
      message: 'A DRAFT projekttel együtt minden belső munkaadat végleg törlődik. Ügyfélkommunikációs vagy Git-átadási előzmény esetén a rendszer megtagadja a törlést.',
      defaultFocus: 'none',
      accept: () => this.deleteProject(),
    });
  }

  deleteProject(): void {
    if (!this.isDeletableDraft() || !this.pending.begin('delete')) return;
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.deleteProject(this.projectId).pipe(
      finalize(() => this.pending.end('delete')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => void this.router.navigate(['/']),
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  isArchived(): boolean {
    return this.view()?.project.status === 'ARCHIVED';
  }

  isDeletableDraft(): boolean {
    return this.view()?.project.status === 'DRAFT';
  }

  private applyProjectPatch(
    project: ProjectWorkspace,
    patch: Partial<ProjectWorkspace>,
  ): void {
    this.view.update((current) => current ? {
      ...current,
      project: {
        ...current.project,
        ...patch,
        updatedAt: project.updatedAt > current.project.updatedAt
          ? project.updatedAt
          : current.project.updatedAt,
      },
    } : current);
  }

  private applyProjectStatus(project: ProjectWorkspace, intent: number): boolean {
    if (intent < this.appliedLifecycleIntent) return false;
    this.appliedLifecycleIntent = intent;
    this.applyProjectPatch(project, { status: project.status });
    if (project.status !== 'ARCHIVED') {
      this.lifecycleForm.reset({ status: project.status });
    }
    return true;
  }

  private resetForms(project: ProjectWorkspace): void {
    this.resetBasicsForm(project);
    if (project.status !== 'ARCHIVED') {
      this.lifecycleForm.reset({ status: project.status });
    }
    this.playbookForm.reset({ playbook: `${project.playbook.id}:${project.playbook.version}` });
  }

  private resetBasicsForm(project: ProjectWorkspace): void {
    this.basicsForm.reset({
      name: project.name,
      internalOwnerName: project.internalOwnerName ?? '',
      customerContactName: project.customerContactName,
      customerContactEmail: project.customerContactEmail,
    });
  }
}

function nonBlankValidator(control: AbstractControl): { nonBlank: true } | null {
  return typeof control.value === 'string' && control.value.trim().length > 0
    ? null
    : { nonBlank: true };
}
