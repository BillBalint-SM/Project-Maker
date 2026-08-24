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
import type { QuestionTemplateSummary } from '@project-maker/contracts';
import { forkJoin } from 'rxjs';

import { ProjectApiService } from './project-api.service';
import { QuestionTemplateApiService } from '../settings/question-template-api.service';

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
  private readonly questionTemplateApi = inject(QuestionTemplateApiService);

  readonly createError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly configurationLoading = signal(true);
  readonly playbooks = signal<readonly PackagedPlaybookSummary[]>([]);
  readonly questionTemplates = signal<readonly QuestionTemplateSummary[]>([]);
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
    questionTemplateId: new FormControl({ value: '', disabled: true }, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    forkJoin({
      playbooks: this.api.listPlaybooks(),
      templates: this.questionTemplateApi.list(),
    }).subscribe({
      next: ({ playbooks, templates }) => {
        this.playbooks.set(playbooks);
        const availableTemplates = templates.filter(
          (template) => template.latestPublishedVersion !== null &&
            template.latestPublishedUnavailableQuestionCount === 0,
        );
        this.questionTemplates.set(availableTemplates);
        if (availableTemplates.length > 0) {
          this.createForm.controls.questionTemplateId.enable({ emitEvent: false });
        }
        if (availableTemplates.length === 1) {
          this.createForm.controls.questionTemplateId.setValue(availableTemplates[0].id);
        }
        this.configurationLoading.set(false);
      },
      error: (error: Error) => {
        this.createError.set(error.message);
        this.configurationLoading.set(false);
      },
    });
  }

  createProject(destination: 'portfolio' | 'schema'): void {
    this.createForm.markAllAsTouched();
    if (
      this.createForm.invalid ||
      this.saving() ||
      this.configurationLoading() ||
      this.questionTemplates().length === 0
    ) {
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
        questionTemplateId: value.questionTemplateId,
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
