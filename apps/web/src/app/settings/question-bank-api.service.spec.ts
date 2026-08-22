import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { QuestionBankApiService } from './question-bank-api.service';

describe('QuestionBankApiService', () => {
  it('returns the nullable Project question-schema response and preserves a 404 as an error', async () => {
    TestBed.configureTestingModule({ providers: [QuestionBankApiService, provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(QuestionBankApiService); const http = TestBed.inject(HttpTestingController);
    const id = '11111111-1111-4111-8111-111111111111';
    const absent = firstValueFrom(api.loadProjectSchema(id));
    http.expectOne(`/api/projects/${id}/question-schema`).flush(null);
    await expect(absent).resolves.toBeNull();
    const missing = firstValueFrom(api.loadProjectSchema(id));
    http.expectOne(`/api/projects/${id}/question-schema`).flush({}, { status: 404, statusText: 'Not Found' });
    await expect(missing).rejects.toThrow('Unable to load the Project question schema. Check that the Project or question still exists.');
    http.verify();
  });
});
