import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  CustomerFollowUpState,
  ProjectPreparationStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CustomerFollowUpApiService } from './customer-follow-up/customer-follow-up-api.service';
import { ProjectApiService } from './project-api.service';
import { ProjectSettingsPage } from './project-settings.page';

const projectId = '11111111-1111-4111-8111-111111111111';
const preparationStatus: ProjectPreparationStatus = {
  projectId,
  state: 'SCHEMA_REQUIRED',
  label: 'Kérdésséma szükséges',
  primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
};
const followUpState: CustomerFollowUpState = {
  projectId,
  messageDraft: 'Kérjük a visszajelzést.',
  referencedFollowUpId: null,
  draftVersion: 1,
  enabled: true,
  intervalMinutes: 10_080,
  expiresAt: null,
  lastPingAt: null,
  nextPingAt: '2026-08-26T08:00:00.000Z',
  lastDeliveryStatus: 'NEVER',
  lastDeliveryError: null,
  latestManualAttempt: null,
};

describe('ProjectSettingsPage', () => {
  it('contains configuration and danger-zone controls without daily work or diagnostics', async () => {
    const project = projectFixture('DRAFT');
    const { fixture } = await createPage(project);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="project-basics-editor"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="customer-contact-settings"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="follow-up-settings-form"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="project-lifecycle-settings"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="project-danger-zone"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="workspace-form"]')).toBeNull();
    expect(root.querySelector('[data-testid="follow-up-draft-form"]')).toBeNull();
    expect(root.querySelector('[data-testid="audit-history-card"]')).toBeNull();
    expect(root.querySelector('app-readiness-review')).toBeNull();
    expect(root.querySelector('app-decision-review')).toBeNull();
    expect(root.querySelector('app-discovery-follow-ups')).toBeNull();
    expect(root.textContent).not.toContain('Cockpit');
  });

  it('keeps archived settings readable and guards every mutation until restore', async () => {
    const project = projectFixture('ARCHIVED');
    const { fixture } = await createPage(project);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Az archivált projekt beállításai olvashatók');
    expect(root.querySelector('[data-testid="restore-project-button"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="archive-project-button"]')).toBeNull();
    expect(root.querySelector('[data-testid="delete-project-button"]')).toBeNull();
    expect(root.querySelector('[data-testid="project-lifecycle-status-value"]')?.textContent)
      .toContain('Archivált');
    expect(root.querySelector('[data-testid="project-lifecycle-status-select"]')).toBeNull();
    expect(
      (root.querySelector('[data-testid="project-basics-fieldset"]') as HTMLFieldSetElement)
        .disabled,
    ).toBe(true);
    expect(
      (root.querySelector('[data-testid="follow-up-settings-fieldset"]') as HTMLFieldSetElement)
        .disabled,
    ).toBe(true);
  });

  it('updates only the administrative lifecycle status from Project settings', async () => {
    const project = projectFixture('DRAFT');
    const { fixture, api } = await createPage(project);

    fixture.componentInstance.lifecycleForm.setValue({ status: 'WAITING_CUSTOMER' });
    fixture.componentInstance.saveProjectStatus();
    await fixture.whenStable();

    expect(api.updateWorkspace).toHaveBeenCalledWith(projectId, {
      status: 'WAITING_CUSTOMER',
    });
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-testid="project-lifecycle-feedback"]')
        ?.textContent,
    ).toContain('A projekt életciklus-állapota frissítve lett.');
  });
});

async function createPage(project: ProjectWorkspace) {
  const api = {
    loadProjectSettings: vi.fn().mockReturnValue(of({ project, preparationStatus })),
    updateProjectBasics: vi.fn(),
    updateWorkspace: vi.fn().mockImplementation(
      (_projectId: string, input: { readonly status?: ProjectWorkspace['status'] }) =>
        of({ ...project, status: input.status ?? project.status }),
    ),
    archiveProject: vi.fn(),
    restoreProject: vi.fn(),
    deleteProject: vi.fn(),
  };
  const followUpApi = {
    load: vi.fn().mockReturnValue(of(followUpState)),
    updateSettings: vi.fn().mockReturnValue(of(followUpState)),
  };
  await TestBed.configureTestingModule({
    imports: [ProjectSettingsPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ projectId }) } },
      },
      { provide: ProjectApiService, useValue: api },
      { provide: CustomerFollowUpApiService, useValue: followUpApi },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProjectSettingsPage);
  await fixture.whenStable();
  return { fixture, api, followUpApi };
}

function projectFixture(status: ProjectWorkspace['status']): ProjectWorkspace {
  return {
    id: projectId,
    name: 'Beállítandó projekt',
    customerContactName: 'Ügyfél Anna',
    customerContactEmail: 'anna@example.test',
    status,
    internalOwnerName: 'PO Péter',
    nextActionOwnerRole: 'INTERNAL_OWNER',
    nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'PO Péter', complete: true },
    nextAction: 'Egyeztesd a következő lépést.',
    dueAt: null,
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-19T08:00:00.000Z',
  };
}
