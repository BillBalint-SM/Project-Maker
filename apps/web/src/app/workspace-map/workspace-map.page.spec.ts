import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { WorkspaceMapPage } from './workspace-map.page';

describe('WorkspaceMapPage', () => {
  it('shows the Project Preparation Journey by default', async () => {
    const params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [WorkspaceMapPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkspaceMapPage);
    await fixture.whenStable();

    const frame = fixture.nativeElement.querySelector(
      '[data-testid="workspace-map-frame"]',
    ) as HTMLIFrameElement;
    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain(
      'Project Preparation Journey',
    );
    expect(frame.getAttribute('title')).toBe(
      'Project Preparation Journey interactive diagram',
    );
    expect(frame.getAttribute('src')).toContain(
      '/diagrams/project-maker-user-workflow.html?embed=1&theme=dark',
    );
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(frame.getAttribute('sandbox')).toBe('allow-downloads allow-scripts');
    expect(
      fixture.nativeElement.querySelector('[data-testid="workspace-map-back-link"]')
        ?.getAttribute('href'),
    ).toBe('/');
  });

  it('preserves a validated selected Project return path across map perspectives', async () => {
    const returnTo = '/projects/project-1/customer-correspondences?returnTo=%2Ffollow-ups';
    const params = new BehaviorSubject(
      convertToParamMap({ view: 'customer-communication', returnTo }),
    );
    await TestBed.configureTestingModule({
      imports: [WorkspaceMapPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkspaceMapPage);
    await fixture.whenStable();

    const backLink = fixture.nativeElement.querySelector(
      '[data-testid="workspace-map-back-link"]',
    ) as HTMLAnchorElement;
    const architectureLink = fixture.nativeElement.querySelector(
      '[data-testid="workspace-map-option-architecture"]',
    ) as HTMLAnchorElement;
    expect(backLink.getAttribute('href')).toBe(returnTo);
    expect(backLink.textContent).toContain('Back to selected Project');
    expect(architectureLink.getAttribute('href')).toContain(
      `returnTo=${encodeURIComponent(returnTo)}`,
    );

    params.next(convertToParamMap({ returnTo: 'https://example.test' }));
    await fixture.whenStable();

    expect(backLink.getAttribute('href')).toBe('/');
    expect(backLink.textContent).toContain('Back to Portfolio Overview');
  });

  it('selects a known map and falls back for an unknown view', async () => {
    const params = new BehaviorSubject(
      convertToParamMap({ view: 'customer-communication' }),
    );
    await TestBed.configureTestingModule({
      imports: [WorkspaceMapPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkspaceMapPage);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain(
      'Customer Correspondence Send and Reply Flow',
    );
    expect(
      fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent,
    ).toContain('Customer communication');

    params.next(convertToParamMap({ view: 'not-a-map' }));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain(
      'Project Preparation Journey',
    );
  });

  it('offers all five canonical English perspectives', async () => {
    const params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [WorkspaceMapPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkspaceMapPage);
    await fixture.whenStable();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.map-selector strong'),
      (element: Element) => element.textContent?.trim(),
    );
    expect(labels).toEqual([
      'User workflow',
      'Preparation lifecycle',
      'Customer communication',
      'Feature and data flow',
      'Runtime architecture',
    ]);
  });
});
