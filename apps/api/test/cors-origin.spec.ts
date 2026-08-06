import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateCorsOrigin } from '../src/cors-origin';

describe('validateCorsOrigin', () => {
  it('accepts one exact HTTP or HTTPS origin', () => {
    assert.equal(validateCorsOrigin('http://localhost:8080'), 'http://localhost:8080');
    assert.equal(validateCorsOrigin('https://project-maker.example'), 'https://project-maker.example');
  });

  it('rejects missing, wildcard, path, credential, and malformed origins', () => {
    const invalidOrigins: Array<string | undefined> = [
      undefined,
      '*',
      'http://localhost:8080/',
      'http://localhost:8080/api',
      'http://user:password@localhost:8080',
      'localhost:8080',
      'https://one.example,https://two.example',
    ];

    for (const origin of invalidOrigins) {
      assert.throws(
        () => validateCorsOrigin(origin),
        /CORS_ORIGIN must be one exact HTTP\(S\) origin/,
      );
    }
  });
});
