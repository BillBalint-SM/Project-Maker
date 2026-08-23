import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import type { AppTheme } from './app-theme.state';
import { AppThemeState } from './app-theme.state';
import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  it('presents the destination theme as its visible action and delegates toggling', async () => {
    const theme = signal<AppTheme>('dark');
    const appTheme = {
      theme: theme.asReadonly(),
      toggleTheme: vi.fn(() =>
        theme.update((current) => current === 'dark' ? 'light' : 'dark'),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [{ provide: AppThemeState, useValue: appTheme }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.textContent?.trim()).toBe('Switch to light theme');
    expect(button.querySelector('[data-icon="sun"]')?.getAttribute('aria-hidden')).toBe('true');

    button.click();
    await fixture.whenStable();

    expect(appTheme.toggleTheme).toHaveBeenCalledOnce();
    expect(button.textContent?.trim()).toBe('Switch to dark theme');
    expect(button.querySelector('[data-icon="moon"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('opts into fixed placement only when the shell requests it', async () => {
    const appTheme = {
      theme: signal<AppTheme>('dark').asReadonly(),
      toggleTheme: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [{ provide: AppThemeState, useValue: appTheme }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ThemeToggleComponent);

    fixture.componentRef.setInput('floating', true);
    await fixture.whenStable();

    expect(
      fixture.nativeElement
        .querySelector('button')
        ?.classList.contains('theme-toggle--floating'),
    ).toBe(true);
  });
});
