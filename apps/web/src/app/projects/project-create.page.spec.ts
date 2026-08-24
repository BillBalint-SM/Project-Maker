import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { QuestionTemplateSummary } from '@project-maker/contracts';

import { appConfig } from '../app.config';
import { QuestionTemplateApiService } from '../settings/question-template-api.service';
import { ProjectApiService } from './project-api.service';
import { ProjectCreatePage } from './project-create.page';

describe('ProjectCreatePage', () => {
  it('requires and submits an available published Question Template', async () => {
    const template = buildTemplate();
    const projectApi = {
      listPlaybooks: vi.fn().mockReturnValue(of([
        { id: 'general', version: 1, name: 'General project discovery' },
      ])),
      createProject: vi.fn().mockReturnValue(of({ id: 'project-1' })),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProjectCreatePage],
      providers: [
        ...appConfig.providers,
        { provide: ProjectApiService, useValue: projectApi },
        { provide: QuestionTemplateApiService, useValue: { list: vi.fn().mockReturnValue(of([template])) } },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProjectCreatePage);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.createForm.setValue({
      name: 'Alpha', customerContactName: 'Ada', customerContactEmail: 'ada@example.com',
      internalOwnerName: 'Grace', playbook: 'general:1', questionTemplateId: template.id,
    });
    fixture.componentInstance.createProject('schema');

    expect(projectApi.createProject).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Alpha', questionTemplateId: template.id,
    }));
    expect(navigate).toHaveBeenCalledWith(['/projects', 'project-1', 'interview']);
  });
});

function buildTemplate(): QuestionTemplateSummary {
  return {
    id: '11111111-1111-4111-8111-111111111111', name: 'Delivery intake',
    draftQuestions: [{ stableKey: 'general-001' }], latestPublishedVersion: 1,
    latestPublishedQuestions: [{ stableKey: 'general-001' }], state: 'PUBLISHED',
    unavailableQuestionCount: 0, latestPublishedUnavailableQuestionCount: 0,
    focusedProject: null, assignedProjects: [], updatedAt: '2026-08-24T00:00:00.000Z',
  };
}
