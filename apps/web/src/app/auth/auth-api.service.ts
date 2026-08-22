import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { McpConnectionStatus, McpConnectionToken } from '@project-maker/contracts';
import { catchError, Observable, tap, throwError } from 'rxjs';

export interface InternalUser {
  readonly id: string;
  readonly email: string;
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface PasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  readonly currentUser = signal<InternalUser | null | undefined>(undefined);

  loadSession(): Observable<InternalUser | null> {
    return this.http
      .get<InternalUser | null>('/api/auth/session')
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  signUp(credentials: Credentials): Observable<InternalUser> {
    return this.authenticate('/api/auth/signup', credentials, 'create the account');
  }

  login(credentials: Credentials): Observable<InternalUser> {
    return this.authenticate('/api/auth/login', credentials, 'sign in');
  }

  restore(credentials: Credentials): Observable<InternalUser> {
    return this.authenticate('/api/auth/restore', credentials, 'restore the account');
  }

  changePassword(input: PasswordChange): Observable<InternalUser> {
    return this.http.post<InternalUser>('/api/auth/password', input).pipe(
      tap((user) => this.currentUser.set(user)),
      catchError((error: unknown) => this.fail(error, 'change the password')),
    );
  }

  deactivate(): Observable<void> {
    return this.http.post<void>('/api/auth/deactivate', {}).pipe(
      tap(() => this.currentUser.set(null)),
      catchError((error: unknown) => this.fail(error, 'deactivate the account')),
    );
  }

  loadMcpConnection(): Observable<McpConnectionStatus> {
    return this.http.get<McpConnectionStatus>('/api/auth/mcp-connection').pipe(
      catchError((error: unknown) => this.fail(error, 'load the Claude Code connection')),
    );
  }

  createMcpConnection(): Observable<McpConnectionToken> {
    return this.http.post<McpConnectionToken>('/api/auth/mcp-connection', {}).pipe(
      catchError((error: unknown) => this.fail(error, 'create the Claude Code connection')),
    );
  }

  revokeMcpConnection(): Observable<void> {
    return this.http.delete<void>('/api/auth/mcp-connection').pipe(
      catchError((error: unknown) => this.fail(error, 'revoke the Claude Code connection')),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(
      tap(() => this.currentUser.set(null)),
      catchError((error: unknown) => this.fail(error, 'sign out')),
    );
  }

  private authenticate(
    endpoint: string,
    credentials: Credentials,
    action: string,
  ): Observable<InternalUser> {
    return this.http.post<InternalUser>(endpoint, credentials).pipe(
      tap((user) => this.currentUser.set(user)),
      catchError((error: unknown) => this.fail(error, action)),
    );
  }

  private fail(error: unknown, action: string): Observable<never> {
    const serverMessage =
      error instanceof HttpErrorResponse &&
      typeof error.error === 'object' &&
      error.error !== null &&
      typeof (error.error as { message?: unknown }).message === 'string'
        ? (error.error as { message: string }).message
        : null;
    return throwError(
      () =>
        new Error(
          serverMessage ??
            `Unable to ${action}. Check your connection and try again.`,
        ),
    );
  }
}
