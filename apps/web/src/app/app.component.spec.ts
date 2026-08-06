import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('renders Project Maker', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const brand = fixture.nativeElement.querySelector('.brand strong') as
      | HTMLElement
      | null;
    expect(brand?.textContent?.trim()).toBe('Project Maker');
  });
});
