import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

export const APP_THEME_STORAGE_KEY = 'project-maker:theme';

const themeColors: Record<AppTheme, string> = {
  dark: '#050611',
  light: '#f4f6fb',
};

@Injectable({ providedIn: 'root' })
export class AppThemeState {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly selectedTheme = signal<AppTheme>(this.readStoredTheme());

  readonly theme = this.selectedTheme.asReadonly();
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    this.applyTheme(this.theme());
  }

  selectTheme(theme: AppTheme): void {
    this.selectedTheme.set(theme);
    this.applyTheme(theme);
    this.storeTheme(theme);
  }

  toggleTheme(): void {
    this.selectTheme(this.isDark() ? 'light' : 'dark');
  }

  private readStoredTheme(): AppTheme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'dark';
    }

    try {
      return this.document.defaultView?.localStorage.getItem(APP_THEME_STORAGE_KEY) === 'light'
        ? 'light'
        : 'dark';
    } catch {
      return 'dark';
    }
  }

  private storeTheme(theme: AppTheme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      this.document.defaultView?.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
    } catch {
      // Theme selection remains usable when storage is unavailable or blocked.
    }
  }

  private applyTheme(theme: AppTheme): void {
    const root = this.document.documentElement;
    root.classList.toggle('pm-dark', theme === 'dark');
    root.classList.toggle('pm-light', theme === 'light');
    root.style.colorScheme = theme;
    this.document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', themeColors[theme]);
  }
}
