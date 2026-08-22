import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  CustomerFollowUpState,
  ProjectPreparationStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';
import { of, Subject, throwError } from 'rxjs';
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
const postSchemaPreparationStatus: ProjectPreparationStatus = {
  projectId,
  state: 'INTAKE_IN_PROGRESS',
  label: 'Kezdő felmérés folyamatban',
  primaryAction: { target: 'INTERVIEW', label: 'Felmérés folytatása' },
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
    expect(root.textContent).toContain('A teljes mentett munkafolyamat és történet olvasható');
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

  it('keeps Project basics and the Customer contact editable after schema publication', async () => {
    const project = projectFixture('DRAFT');
    const { fixture } = await createPage(project, postSchemaPreparationStatus);

    const root = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.canEditBasics()).toBe(true);
    expect(
      (root.querySelector('[data-testid="project-basics-fieldset"]') as HTMLFieldSetElement)
        .disabled,
    ).toBe(false);
    expect(root.querySelector('[data-testid="save-project-basics"]')).not.toBeNull();
  });

  it('continues the restored workflow in its retained administrative phase', async () => {
    const project = projectFixture('ARCHIVED');
    const { fixture, api } = await createPage(project);
    api.restoreProject.mockReturnValue(of({
      ...project,
      status: 'WAITING_CUSTOMER',
      updatedAt: '2026-08-22T12:00:00.000Z',
    }));

    fixture.componentInstance.restoreProject();
    await fixture.whenStable();

    expect(api.restoreProject).toHaveBeenCalledWith(projectId);
    expect(fixture.componentInstance.view()?.project.status).toBe('WAITING_CUSTOMER');
    expect(fixture.componentInstance.lifecycleForm.controls.status.value).toBe('WAITING_CUSTOMER');
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-testid="project-settings-action-success"]')
        ?.textContent,
    ).toContain(
      'A projekt az archiválás előtti állapotban, az Ügyfél-visszajelzésre vár fázisban folytatható. Korábbi esemény vagy küldés nem ismétlődött meg.',
    );
  });

  it('updates only the administrative project phase from Project settings', async () => {
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
    ).toContain('Az adminisztratív projektfázis frissítve lett.');
  });

  it('keeps independent saves pending and combines out-of-order responses', async () => {
    const project = projectFixture('DRAFT');
    const basicsResult = new Subject<ProjectWorkspace>();
    const statusResult = new Subject<ProjectWorkspace>();
    const { fixture, api } = await createPage(project);
    api.updateProjectBasics.mockReturnValue(basicsResult);
    api.updateWorkspace.mockReturnValue(statusResult);

    fixture.componentInstance.basicsForm.setValue({
      name: 'Frissített projekt',
      internalOwnerName: 'PO Petra',
      customerContactName: 'Ügyfél Ágnes',
      customerContactEmail: 'agnes@example.test',
    });
    fixture.componentInstance.lifecycleForm.setValue({ status: 'WAITING_CUSTOMER' });
    fixture.componentInstance.saveProjectBasics();
    fixture.componentInstance.saveProjectStatus();

    expect(fixture.componentInstance.basicsSaving()).toBe(true);
    expect(fixture.componentInstance.lifecycleSaving()).toBe(true);

    statusResult.next({
      ...project,
      status: 'WAITING_CUSTOMER',
      updatedAt: '2026-08-22T09:00:00.000Z',
    });
    statusResult.complete();

    expect(fixture.componentInstance.lifecycleSaving()).toBe(false);
    expect(fixture.componentInstance.basicsSaving()).toBe(true);
    expect(fixture.componentInstance.view()?.project.status).toBe('WAITING_CUSTOMER');

    basicsResult.next({
      ...project,
      name: 'Frissített projekt',
      internalOwnerName: 'PO Petra',
      customerContactName: 'Ügyfél Ágnes',
      customerContactEmail: 'agnes@example.test',
      updatedAt: '2026-08-22T10:00:00.000Z',
    });
    basicsResult.complete();

    expect(fixture.componentInstance.basicsSaving()).toBe(false);
    expect(fixture.componentInstance.view()?.project).toMatchObject({
      name: 'Frissített projekt',
      internalOwnerName: 'PO Petra',
      customerContactName: 'Ügyfél Ágnes',
      customerContactEmail: 'agnes@example.test',
      status: 'WAITING_CUSTOMER',
    });
  });

  it('keeps the newest successful lifecycle response when an older save finishes later', async () => {
    const project = projectFixture('DRAFT');
    const statusResult = new Subject<ProjectWorkspace>();
    const archiveResult = new Subject<ProjectWorkspace>();
    const { fixture, api } = await createPage(project);
    api.updateWorkspace.mockReturnValue(statusResult);
    api.archiveProject.mockReturnValue(archiveResult);

    fixture.componentInstance.lifecycleForm.setValue({ status: 'WAITING_CUSTOMER' });
    fixture.componentInstance.saveProjectStatus();
    fixture.componentInstance.archiveProject();

    expect(fixture.componentInstance.lifecycleSaving()).toBe(true);
    expect(fixture.componentInstance.transitioning()).toBe(true);

    archiveResult.next({
      ...project,
      status: 'ARCHIVED',
      updatedAt: '2026-08-22T11:00:00.000Z',
    });
    archiveResult.complete();
    expect(fixture.componentInstance.view()?.project.status).toBe('ARCHIVED');

    statusResult.next({
      ...project,
      status: 'WAITING_CUSTOMER',
      updatedAt: '2026-08-22T10:00:00.000Z',
    });
    statusResult.complete();

    expect(fixture.componentInstance.lifecycleSaving()).toBe(false);
    expect(fixture.componentInstance.transitioning()).toBe(false);
    expect(fixture.componentInstance.view()?.project.status).toBe('ARCHIVED');
    expect(fixture.componentInstance.lifecycleFeedback()).toBeNull();
  });

  it('releases a failed command so the same save can be retried', async () => {
    const project = projectFixture('DRAFT');
    const { fixture, api } = await createPage(project);
    api.updateProjectBasics
      .mockReturnValueOnce(throwError(() => new Error('Az alapadatok most nem menthetők.')))
      .mockReturnValueOnce(of({ ...project, name: 'Újrapróbált projekt' }));
    fixture.componentInstance.basicsForm.setValue({
      name: 'Újrapróbált projekt',
      internalOwnerName: project.internalOwnerName ?? '',
      customerContactName: project.customerContactName,
      customerContactEmail: project.customerContactEmail,
    });

    fixture.componentInstance.saveProjectBasics();

    expect(fixture.componentInstance.basicsSaving()).toBe(false);
    expect(fixture.componentInstance.basicsError()).toBe('Az alapadatok most nem menthetők.');

    fixture.componentInstance.saveProjectBasics();

    expect(api.updateProjectBasics).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.basicsError()).toBeNull();
    expect(fixture.componentInstance.basicsFeedback()).toBe(
      'A projekt alapadatai mentve lettek.',
    );
    expect(fixture.componentInstance.view()?.project.name).toBe('Újrapróbált projekt');
  });
});

async function createPage(
  project: ProjectWorkspace,
  currentPreparationStatus = preparationStatus,
) {
  const api = {
    listPlaybooks: vi.fn().mockReturnValue(of([])),
    loadProjectSettings: vi.fn().mockReturnValue(of({
      project,
      preparationStatus: currentPreparationStatus,
    })),
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
    playbook: { id: 'general', version: 1, name: 'Általános projekt' },
    initiativeId: null,
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-19T08:00:00.000Z',
  };
}
