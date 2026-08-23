import { Component, computed, inject, input } from '@angular/core';

import { AppThemeState } from './app-theme.state';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent {
  private readonly appTheme = inject(AppThemeState);

  readonly floating = input(false);
  readonly theme = this.appTheme.theme;
  readonly actionLabel = computed(() =>
    this.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );

  toggleTheme(): void {
    this.appTheme.toggleTheme();
  }
}
