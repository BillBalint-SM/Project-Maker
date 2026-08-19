import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ProjectApiService } from './project-api.service';

describe('ProjectApiService', () => {
  it('loads the canonical Portfolio and selected-Project work-state resources', async () => {
    TestBed.configureTestingModule({
      providers: [ProjectApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(ProjectApiService);
    const http = TestBed.inject(HttpTestingController);
    const projectId = '11111111-1111-4111-8111-111111111111';

    const portfolio = firstValueFrom(api.loadPortfolio());
    const portfolioRequest = http.expectOne('/api/projects/portfolio');
    expect(portfolioRequest.request.method).toBe('GET');
    portfolioRequest.flush([]);
    await expect(portfolio).resolves.toEqual([]);

    const workState = firstValueFrom(api.loadWorkState(projectId));
    const workStateRequest = http.expectOne(`/api/projects/${projectId}/work-state`);
    expect(workStateRequest.request.method).toBe('GET');
    workStateRequest.flush({ projectId });
    await expect(workState).resolves.toEqual({ projectId });
    http.verify();
  });

  it('maps Project activity failures to safe, actionable Hungarian copy', async () => {
    TestBed.configureTestingModule({
      providers: [ProjectApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(ProjectApiService);
    const http = TestBed.inject(HttpTestingController);
    const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const projectId = '11111111-1111-4111-8111-111111111111';

    const activity = firstValueFrom(api.loadProjectActivity(projectId));
    http.expectOne(`/api/projects/${projectId}/activity`).flush(
      { detail: 'internal database connection name must not leak' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    await expect(activity).rejects.toThrow(
      'Nem sikerült betölteni a legutóbbi projektaktivitást. A szolgáltatás átmenetileg nem érhető el. Várj röviden, majd próbáld újra.',
    );
    expect(diagnostics).toHaveBeenCalledWith(
      'Project API request failed.',
      expect.objectContaining({ status: 503 }),
    );
    expect(diagnostics.mock.calls.flat().join(' ')).not.toContain('internal database');
    diagnostics.mockRestore();
    http.verify();
  });
});
