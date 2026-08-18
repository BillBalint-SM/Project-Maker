import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import { AppComponent } from './app.component';
import { CustomerRepliesApiService } from './projects/customer-replies-api.service';

describe('AppComponent', () => {
  it('renders Project Maker', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: CustomerRepliesApiService,
          useValue: {
            summaryChanges: of({ newReplyCount: 3, projectCount: 1, projects: [] }),
            summary: () => of({ newReplyCount: 3, projectCount: 1, projects: [] }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const brand = fixture.nativeElement.querySelector('.brand strong') as
      | HTMLElement
      | null;
    expect(brand?.textContent?.trim()).toBe('Project Maker');
    expect(fixture.nativeElement.querySelector('[data-testid="global-customer-reply-count"]')?.textContent).toContain('(3)');
  });
});
