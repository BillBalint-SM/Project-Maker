import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { McpConnectionStatus } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';

import { AuthApiService } from './auth-api.service';

@Component({
  selector: 'app-account-page',
  imports: [ButtonModule, CardModule, DatePipe, InputTextModule, ReactiveFormsModule],
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
})
export class AccountPage {
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.currentUser;
  readonly pending = signal(false);
  readonly mcpPending = signal(false);
  readonly mcpStatus = signal<McpConnectionStatus | null>(null);
  readonly mcpToken = signal<string | null>(null);
  readonly mcpEndpoint = `${location.origin}/mcp`;
  readonly mcpCommand = computed(() => {
    const token = this.mcpToken();
    return token
      ? `claude mcp add --transport http --scope user project-maker ${this.mcpEndpoint} --header "Authorization: Bearer ${token}"`
      : null;
  });
  readonly feedback = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
  });

  constructor() {
    this.loadMcpConnection();
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.feedback.set(null);
    this.actionError.set(null);
    this.auth
      .changePassword(this.passwordForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pending.set(false);
          this.passwordForm.reset();
          this.feedback.set('A jelszó megváltozott.');
        },
        error: (error: Error) => {
          this.pending.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  deactivate(): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.feedback.set(null);
    this.actionError.set(null);
    this.auth
      .deactivate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(['/login']),
        error: (error: Error) => {
          this.pending.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  createMcpConnection(): void {
    if (this.mcpPending()) return;
    this.mcpPending.set(true);
    this.feedback.set(null);
    this.actionError.set(null);
    this.auth
      .createMcpConnection()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (connection) => {
          this.mcpPending.set(false);
          this.mcpToken.set(connection.token);
          this.mcpStatus.set({ configured: true, createdAt: connection.createdAt });
          this.feedback.set('A Claude Code-kapcsolati token elkészült. Add hozzá most a mutatott paranccsal.');
        },
        error: (error: Error) => {
          this.mcpPending.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  revokeMcpConnection(): void {
    if (this.mcpPending()) return;
    this.mcpPending.set(true);
    this.feedback.set(null);
    this.actionError.set(null);
    this.auth
      .revokeMcpConnection()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mcpPending.set(false);
          this.mcpToken.set(null);
          this.mcpStatus.set({ configured: false, createdAt: null });
          this.feedback.set('A Claude Code-kapcsolat megszűnt.');
        },
        error: (error: Error) => {
          this.mcpPending.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  async copyMcpCommand(): Promise<void> {
    const command = this.mcpCommand();
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      this.feedback.set('A kapcsolódási parancs a vágólapra került.');
    } catch {
      this.actionError.set('A másolás nem sikerült. Jelöld ki és másold a parancsot kézzel.');
    }
  }

  private loadMcpConnection(): void {
    this.mcpPending.set(true);
    this.auth
      .loadMcpConnection()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.mcpPending.set(false);
          this.mcpStatus.set(status);
        },
        error: (error: Error) => {
          this.mcpPending.set(false);
          this.actionError.set(error.message);
        },
      });
  }
}
