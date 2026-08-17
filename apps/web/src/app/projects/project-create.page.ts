import { Component, inject, signal } from '@angular/core';
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
export class ProjectCreatePage {
  private readonly api = inject(ProjectApiService);
  private readonly router = inject(Router);

  readonly createError = signal<string | null>(null);
  readonly saving = signal(false);

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
  });

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
        internalOwnerName: value.internalOwnerName.trim(),
        nextActionOwnerRole: 'INTERNAL_OWNER',
      })
      .subscribe({
        next: (project) => {
          this.saving.set(false);
          void this.router.navigate(['/projects', project.id, 'interview']);
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
