import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import type { ProjectWorkspace } from '@project-maker/contracts';

import { ProjectApiService } from './project-api.service';

@Component({
  selector: 'app-project-list-page',
  imports: [
    ButtonModule,
    CardModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    TagModule,
  ],
  templateUrl: './project-list.page.html',
  styleUrl: './project-list.page.scss',
})
export class ProjectListPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly router = inject(Router);

  readonly projects = signal<readonly ProjectWorkspace[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showCreateForm = signal(false);

  readonly createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    customerContactName: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    customerContactEmail: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(320),
      ],
    }),
  });

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.listProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
    this.createError.set(null);
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.createError.set(null);
    this.createForm.reset();
  }

  createProject(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.saving()) {
      return;
    }

    const value = this.createForm.getRawValue();
    this.saving.set(true);
    this.createError.set(null);
    this.api
      .createProject({
        name: value.name.trim(),
        customerContactName: value.customerContactName.trim(),
        customerContactEmail: value.customerContactEmail.trim(),
      })
      .subscribe({
        next: (project) => {
          this.saving.set(false);
          void this.router.navigate(['/projects', project.id]);
        },
        error: (error: Error) => {
          this.createError.set(error.message);
          this.saving.set(false);
        },
      });
  }
}

function nonBlankValidator(control: AbstractControl): { nonBlank: true } | null {
  return typeof control.value === 'string' && control.value.trim().length > 0
    ? null
    : { nonBlank: true };
}
