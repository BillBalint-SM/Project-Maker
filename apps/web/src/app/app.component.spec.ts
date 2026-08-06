import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('renders Project Maker', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h1') as
      | HTMLHeadingElement
      | null;
    expect(heading?.textContent?.trim()).toBe('Project Maker');
  });
});
