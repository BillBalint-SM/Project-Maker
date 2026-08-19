import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  ActiveProjectQueueApiService,
  ActiveProjectQueueCursorRequestError,
} from './active-project-queue-api.service';

describe('ActiveProjectQueueApiService', () => {
  it('sends the opaque cursor and preserves a stable cursor error classification', async () => {
    TestBed.configureTestingModule({
      providers: [
        ActiveProjectQueueApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const api = TestBed.inject(ActiveProjectQueueApiService);
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(api.getPage({ search: 'projekt', cursor: 'opaque-token' }));
    const request = http.expectOne((candidate) =>
      candidate.url === '/api/projects/active-queue'
      && candidate.params.get('q') === 'projekt'
      && candidate.params.get('cursor') === 'opaque-token');
    request.flush({ code: 'MISMATCHED_CURSOR' }, {
      status: 400,
      statusText: 'Bad Request',
    });

    await expect(result).rejects.toEqual(
      expect.objectContaining<Partial<ActiveProjectQueueCursorRequestError>>({
        code: 'MISMATCHED_CURSOR',
      }),
    );
    http.verify();
  });
});
