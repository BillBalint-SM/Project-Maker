import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { InterviewHandoffApiService } from './interview-handoff-api.service';
import { InterviewHandoffComponent } from './interview-handoff.component';

describe('InterviewHandoffComponent', () => {
  it('shows the dedicated correspondence identity as read-only context and previews without a sender choice', async () => {
    const preview = vi.fn().mockReturnValue(of({
      handoffId: 'handoff-1',
      version: 1,
      recipientName: 'Ügyfél Anna',
      recipientEmail: 'anna@example.test',
      senderName: 'Project Maker',
      senderAddress: 'project-maker@example.test',
      subject: 'Felmérési összefoglaló',
      htmlContent: '<p>Összefoglaló</p>',
      textContent: 'Összefoglaló',
      sourceContentVersion: 3,
      previewDigest: 'a'.repeat(64),
    }));
    const api = {
      senderIdentity: vi.fn().mockReturnValue(of({
        name: 'Project Maker',
        address: 'project-maker@example.test',
      })),
      list: vi.fn().mockReturnValue(of([{
        id: 'handoff-1',
        projectId: 'project-1',
        roundId: 'round-1',
        version: 1,
        state: 'DRAFT',
        modificationSummary: null,
        supersedesHandoffId: null,
        recipientName: null,
        recipientEmail: null,
        senderName: null,
        senderAddress: null,
        createdAt: '2026-08-20T08:00:00.000Z',
        attemptedAt: null,
        sentAt: null,
        receiptEvidence: false,
      }])),
      preview,
    };

    await TestBed.configureTestingModule({
      imports: [InterviewHandoffComponent],
      providers: [{ provide: InterviewHandoffApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(InterviewHandoffComponent);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.componentRef.setInput('roundId', 'round-1');
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="handoff-sender-identity"]')?.textContent)
      .toContain('Project Maker <project-maker@example.test>');
    expect(root.querySelector('input[type="radio"]')).toBeNull();
    expect(root.querySelector('[data-testid="handoff-sender-name"]')).toBeNull();
    expect(root.querySelector('[data-testid="handoff-sender-address"]')).toBeNull();

    (root.querySelector('[data-testid="handoff-preview-button"] button') as HTMLButtonElement)
      .click();
    await fixture.whenStable();

    expect(preview).toHaveBeenCalledWith('project-1', 'round-1', 'handoff-1');
    expect(root.querySelector('.preview')?.textContent)
      .toContain('Project Maker <project-maker@example.test>');
  });
});
