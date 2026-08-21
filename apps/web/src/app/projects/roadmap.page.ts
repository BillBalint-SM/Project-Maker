import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { BusinessRoadmap, RoadmapProject } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';

import { DecisionPortfolioApiService } from './decision-portfolio-api.service';

@Component({
  selector: 'app-roadmap-page',
  imports: [ButtonModule, CardModule, MessageModule, ReactiveFormsModule, RouterLink],
  templateUrl: './roadmap.page.html',
  styleUrl: './roadmap.page.scss',
})
export class RoadmapPage implements OnInit {
  private readonly api = inject(DecisionPortfolioApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roadmap = signal<BusinessRoadmap | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly goalForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2_000)] }),
  });
  readonly initiativeForm = new FormGroup({
    goalId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2_000)] }),
  });
  readonly initiatives = computed(() =>
    (this.roadmap()?.goals ?? []).flatMap((goal) =>
      goal.initiatives.map((initiative) => ({
        id: initiative.id,
        label: `${goal.name} / ${initiative.name}`,
      })),
    ),
  );
  readonly projects = computed(() => {
    const roadmap = this.roadmap();
    if (!roadmap) return [];
    const assigned = roadmap.goals.flatMap((goal) =>
      goal.initiatives.flatMap((initiative) =>
        initiative.projects.map((project) => ({ project, initiativeId: initiative.id })),
      ),
    );
    return [
      ...assigned,
      ...roadmap.unassignedProjects.map((project) => ({ project, initiativeId: null })),
    ].sort((left, right) => left.project.name.localeCompare(right.project.name, 'hu'));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.roadmap().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (roadmap) => {
        this.roadmap.set(roadmap);
        const currentGoalId = this.initiativeForm.controls.goalId.value;
        if (!roadmap.goals.some((goal) => goal.id === currentGoalId)) {
          this.initiativeForm.controls.goalId.setValue(roadmap.goals[0]?.id ?? '');
        }
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  createGoal(): void {
    this.goalForm.markAllAsTouched();
    if (this.goalForm.invalid || this.saving()) return;
    const value = this.goalForm.getRawValue();
    this.startSave();
    this.api.createGoal({ name: value.name.trim(), description: emptyToNull(value.description) }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (goal) => {
        this.initiativeForm.controls.goalId.setValue(goal.id);
        this.goalForm.reset({ name: '', description: '' });
        this.finishSave('Az üzleti cél létrejött.');
      },
      error: (error: Error) => this.failSave(error),
    });
  }

  createInitiative(): void {
    this.initiativeForm.markAllAsTouched();
    if (this.initiativeForm.invalid || this.saving()) return;
    const value = this.initiativeForm.getRawValue();
    this.startSave();
    this.api.createInitiative(value.goalId, {
      name: value.name.trim(),
      description: emptyToNull(value.description),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.initiativeForm.patchValue({ name: '', description: '' });
        this.finishSave('A kezdeményezés létrejött.');
      },
      error: (error: Error) => this.failSave(error),
    });
  }

  assignProject(project: RoadmapProject, event: Event): void {
    const initiativeId = (event.target as HTMLSelectElement).value || null;
    this.startSave();
    this.api.assignProject(project.id, { initiativeId }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.finishSave('A projekt roadmap-helye frissült.'),
      error: (error: Error) => this.failSave(error),
    });
  }

  renameGoal(goalId: string, currentName: string, description: string | null): void {
    const name = window.prompt('Üzleti cél neve', currentName)?.trim();
    if (!name || name === currentName) return;
    this.startSave();
    this.api.updateGoal(goalId, { name, description }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.finishSave('Az üzleti cél átnevezve.'),
      error: (error: Error) => this.failSave(error),
    });
  }

  renameInitiative(initiativeId: string, currentName: string, description: string | null): void {
    const name = window.prompt('Kezdeményezés neve', currentName)?.trim();
    if (!name || name === currentName) return;
    this.startSave();
    this.api.updateInitiative(initiativeId, { name, description }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.finishSave('A kezdeményezés átnevezve.'),
      error: (error: Error) => this.failSave(error),
    });
  }

  deleteGoal(goalId: string): void {
    if (!window.confirm('Törlöd az üzleti célt? A kezdeményezései törlődnek, a projektek besorolás nélkül maradnak.')) return;
    this.startSave();
    this.api.deleteGoal(goalId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.finishSave('Az üzleti cél törölve, a projektek megmaradtak.'),
      error: (error: Error) => this.failSave(error),
    });
  }

  deleteInitiative(initiativeId: string): void {
    if (!window.confirm('Törlöd a kezdeményezést? A projektek besorolás nélkül maradnak.')) return;
    this.startSave();
    this.api.deleteInitiative(initiativeId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.finishSave('A kezdeményezés törölve, a projektek megmaradtak.'),
      error: (error: Error) => this.failSave(error),
    });
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
}

function emptyToNull(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}
