import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ProjectApiService } from './project-api.service';

describe('ProjectApiService work-state adapters', () => {
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
});
