import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerMailboxSyncStatus } from '@project-maker/contracts';

import { CustomerMailboxSyncApiService } from './customer-mailbox-sync-api.service';
import { CustomerRepliesApiService } from './customer-replies-api.service';
import { ProjectApiService } from './project-api.service';
import { ProjectListPage } from './project-list.page';

describe('ProjectListPage customer mailbox synchronization', () => {
  it('shows mailbox freshness and refreshes through the employee action', async () => {
    const initial: CustomerMailboxSyncStatus = {
      mailboxAddress: 'project-maker@pte.hu',
      state: 'DELAYED',
      baselineEstablished: true,
      lastSuccessfulSyncAt: '2026-08-18T10:00:00.000Z',
      refreshInProgress: false,
    };
    const refreshed: CustomerMailboxSyncStatus = {
      ...initial,
      state: 'CURRENT',
      lastSuccessfulSyncAt: '2026-08-18T12:00:00.000Z',
    };
    const mailboxApi = {
      status: vi.fn().mockReturnValue(of(initial)),
      refresh: vi.fn().mockReturnValue(of(refreshed)),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectListPage],
      providers: [
        provideRouter([]),
        {
          provide: ProjectApiService,
          useValue: { listProjects: vi.fn().mockReturnValue(of([])) },
        },
        { provide: CustomerMailboxSyncApiService, useValue: mailboxApi },
        {
          provide: CustomerRepliesApiService,
          useValue: {
            summary: vi.fn().mockReturnValue(of({ newReplyCount: 0, projectCount: 0, projects: [] })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="mailbox-sync-status"]')?.textContent,
    ).toContain('Postafiók-szinkron késik');
    expect(
      fixture.nativeElement.querySelector('[data-testid="active-project-queue-link"]')?.getAttribute('href'),
    ).toBe('/projects/active');

    const refreshHost = fixture.nativeElement.querySelector(
      '[data-testid="refresh-customer-mailbox"]',
    ) as HTMLElement | null;
    (refreshHost?.querySelector('button') ?? refreshHost)?.dispatchEvent(new MouseEvent('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mailboxApi.refresh).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="mailbox-sync-status"]')?.textContent,
    ).toContain('Postafiók naprakész');
  });
});
