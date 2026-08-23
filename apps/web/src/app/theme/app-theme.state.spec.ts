import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_THEME_STORAGE_KEY, AppThemeState } from './app-theme.state';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('AppThemeState', () => {
  let storage: Storage;
  let themeColorMeta: HTMLMetaElement;
  let createdThemeColorMeta = false;
  let originalThemeColor = '';

  beforeEach(() => {
    storage = createMemoryStorage();
    const testDocument = {
      defaultView: { localStorage: storage },
      documentElement: document.documentElement,
      querySelector: document.querySelector.bind(document),
    } as unknown as Document;

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: testDocument }],
    });
    document.documentElement.classList.remove('pm-dark', 'pm-light');
    document.documentElement.style.removeProperty('color-scheme');

    const existingMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColorMeta = existingMeta ?? document.createElement('meta');
    originalThemeColor = themeColorMeta.content;
    if (!existingMeta) {
      createdThemeColorMeta = true;
      themeColorMeta.name = 'theme-color';
      document.head.append(themeColorMeta);
    }
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    storage.clear();
    document.documentElement.classList.remove('pm-dark', 'pm-light');
    document.documentElement.style.removeProperty('color-scheme');
    if (createdThemeColorMeta) {
      themeColorMeta.remove();
      createdThemeColorMeta = false;
    } else {
      themeColorMeta.content = originalThemeColor;
    }
  });

  it('defaults to dark without consulting the operating-system preference', () => {
    const state = TestBed.inject(AppThemeState);

    expect(state.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('pm-dark')).toBe(true);
    expect(document.documentElement.classList.contains('pm-light')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(themeColorMeta.content).toBe('#050611');
  });

  it('restores a persisted light selection and applies its browser chrome color', () => {
    storage.setItem(APP_THEME_STORAGE_KEY, 'light');

    const state = TestBed.inject(AppThemeState);

    expect(state.theme()).toBe('light');
    expect(document.documentElement.classList.contains('pm-light')).toBe(true);
    expect(document.documentElement.classList.contains('pm-dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(themeColorMeta.content).toBe('#f4f6fb');
  });

  it('toggles the selected theme, root classes, and persisted preference together', () => {
    const state = TestBed.inject(AppThemeState);

    state.toggleTheme();

    expect(state.theme()).toBe('light');
    expect(document.documentElement.classList.contains('pm-light')).toBe(true);
    expect(storage.getItem(APP_THEME_STORAGE_KEY)).toBe('light');

    state.toggleTheme();

    expect(state.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('pm-dark')).toBe(true);
    expect(storage.getItem(APP_THEME_STORAGE_KEY)).toBe('dark');
  });
});
