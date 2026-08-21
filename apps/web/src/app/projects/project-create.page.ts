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
import type { PackagedPlaybookSummary } from '@project-maker/contracts';

import { ProjectApiService } from './project-api.service';

@Component({
  selector: 'app-project-create-page',
  imports: [
    ButtonModule,
    CardModule,
    InputTextModule,
    MessageModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './project-create.page.html',
  styleUrl: './project-create.page.scss',
})
export class ProjectCreatePage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly router = inject(Router);

  readonly createError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly playbooks = signal<readonly PackagedPlaybookSummary[]>([]);
  private readonly creationRequestId = crypto.randomUUID();

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
    internalOwnerName: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    playbook: new FormControl('general:1', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    this.api.listPlaybooks().subscribe({
      next: (playbooks) => this.playbooks.set(playbooks),
      error: (error: Error) => this.createError.set(error.message),
    });
  }

  createProject(destination: 'portfolio' | 'schema'): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.saving()) {
      return;
    }

    const value = this.createForm.getRawValue();
    const [playbookId, versionText] = value.playbook.split(':');
    this.saving.set(true);
    this.createError.set(null);
    this.api
      .createProject({
        creationRequestId: this.creationRequestId,
        name: value.name.trim(),
        customerContactName: value.customerContactName.trim(),
        customerContactEmail: value.customerContactEmail.trim(),
        internalOwnerName: value.internalOwnerName.trim(),
        nextActionOwnerRole: 'INTERNAL_OWNER',
        playbookId,
        playbookVersion: Number(versionText),
      })
      .subscribe({
        next: (project) => {
          this.saving.set(false);
          void this.router.navigate(
            destination === 'portfolio'
              ? ['/']
              : ['/projects', project.id, 'interview'],
          );
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
