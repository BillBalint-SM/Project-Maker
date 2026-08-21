import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { GitAuthenticationMode, GitConnectionTestResult, GitSetup, SaveGitSetupInput } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { DeliveryApiService } from '../projects/delivery/delivery-api.service';

const authenticationOptions: { readonly label: string; readonly value: GitAuthenticationMode }[] = [
  { label: 'HTTPS token', value: 'HTTPS_TOKEN' },
  { label: 'SSH kulcs', value: 'SSH_KEY' },
];

@Component({
  selector: 'app-git-setup-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    SelectModule,
    TextareaModule,
  ],
  templateUrl: './git-setup.page.html',
  styleUrl: './git-setup.page.scss',
})
export class GitSetupPage implements OnInit {
  private readonly api = inject(DeliveryApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly authenticationOptions = authenticationOptions;
  readonly setups = signal<readonly GitSetup[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testingId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly testResults = signal<Readonly<Record<string, GitConnectionTestResult>>>({});
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    remoteUrl: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2_000)] }),
    branch: new FormControl('main', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    authenticationMode: new FormControl<GitAuthenticationMode>('HTTPS_TOKEN', { nonNullable: true }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
    accessToken: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20_000)] }),
    privateKey: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40_000)] }),
    passphrase: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(10_000)] }),
    repositoryWebUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2_000)] }),
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listGitSetups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (setups) => {
        this.setups.set(setups);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const editingId = this.editingId();
    const credential = value.authenticationMode === 'HTTPS_TOKEN'
      ? value.accessToken.trim() ? { accessToken: value.accessToken } : undefined
      : value.privateKey.trim() ? { privateKey: value.privateKey, passphrase: emptyToNull(value.passphrase) } : undefined;
    if (!editingId && !credential) {
      this.error.set(value.authenticationMode === 'HTTPS_TOKEN'
        ? 'Az új HTTPS setuphoz add meg a hozzáférési tokent.'
        : 'Az új SSH setuphoz add meg a privát kulcsot.');
      return;
    }
    const input: SaveGitSetupInput = {
      name: value.name.trim(),
      remoteUrl: value.remoteUrl.trim(),
      branch: value.branch.trim(),
      authenticationMode: value.authenticationMode,
      username: emptyToNull(value.username),
      credential,
      repositoryWebUrl: emptyToNull(value.repositoryWebUrl),
    };
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    const request = editingId
      ? this.api.updateGitSetup(editingId, input)
      : this.api.createGitSetup(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.feedback.set(editingId ? 'A közös Git setup frissült.' : 'A közös Git setup létrejött.');
        this.cancelEdit();
        this.load();
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.saving.set(false);
      },
    });
  }

  edit(setup: GitSetup): void {
    this.editingId.set(setup.id);
    this.error.set(null);
    this.feedback.set(null);
    this.form.reset({
      name: setup.name,
      remoteUrl: setup.remoteUrl,
      branch: setup.branch,
      authenticationMode: setup.authenticationMode,
      username: setup.username ?? '',
      accessToken: '',
      privateKey: '',
      passphrase: '',
      repositoryWebUrl: setup.repositoryWebUrl ?? '',
    });
    document.querySelector<HTMLElement>('#git-setup-form-title')?.focus();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '', remoteUrl: '', branch: 'main', authenticationMode: 'HTTPS_TOKEN',
      username: '', accessToken: '', privateKey: '', passphrase: '', repositoryWebUrl: '',
    });
  }

  test(setup: GitSetup): void {
    if (this.testingId()) return;
    this.testingId.set(setup.id);
    this.error.set(null);
    this.api.testGitSetup(setup.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.testResults.update((current) => ({ ...current, [setup.id]: result }));
        this.testingId.set(null);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.testingId.set(null);
      },
    });
  }

  remove(setup: GitSetup): void {
    if (this.saving() || !window.confirm(`Törlöd a(z) „${setup.name}” közös Git setupot?`)) return;
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.deleteGitSetup(setup.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.editingId() === setup.id) this.cancelEdit();
        this.saving.set(false);
        this.feedback.set('A Git setup törölve lett. A korábbi átadások története megmaradt.');
        this.load();
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.saving.set(false);
      },
    });
  }
}

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}
