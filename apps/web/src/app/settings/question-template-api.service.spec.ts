import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { QuestionTemplateApiService } from './question-template-api.service';

describe('QuestionTemplateApiService', () => {
  it('uses the Question Template draft, publish, and list endpoints', async () => {
    TestBed.configureTestingModule({
      providers: [QuestionTemplateApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(QuestionTemplateApiService);
    const http = TestBed.inject(HttpTestingController);
    const id = '11111111-1111-4111-8111-111111111111';
    const input = { name: 'Delivery intake', questions: [{ stableKey: 'general-001' }] };

    const list = firstValueFrom(api.list());
    http.expectOne('/api/settings/question-templates').flush([]);
    await expect(list).resolves.toEqual([]);

    const create = firstValueFrom(api.create(input));
    const createRequest = http.expectOne('/api/settings/question-templates');
    expect(createRequest.request.method).toBe('POST');
    createRequest.flush({ id });
    await create;

    const update = firstValueFrom(api.updateDraft(id, input));
    const updateRequest = http.expectOne(`/api/settings/question-templates/${id}/draft`);
    expect(updateRequest.request.method).toBe('PUT');
    updateRequest.flush({ id });
    await update;

    const publish = firstValueFrom(api.publish(id));
    const publishRequest = http.expectOne(`/api/settings/question-templates/${id}/publish`);
    expect(publishRequest.request.method).toBe('POST');
    publishRequest.flush({ id });
    await publish;

    const remove = firstValueFrom(api.delete(id));
    const deleteRequest = http.expectOne(`/api/settings/question-templates/${id}`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await remove;
    http.verify();
  });
});
