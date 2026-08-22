import { describe, expect, it } from 'vitest';

import { genericHttpErrorMessage } from './http-error-message';

describe('genericHttpErrorMessage', () => {
  it('uses controlled English copy instead of an arbitrary server message', () => {
    const error = {
      status: 500,
      error: { message: 'internal diagnostic must not reach the UI' },
    };

    expect(genericHttpErrorMessage(error, 'save the data')).toBe(
      'Unable to save the data. Try again.',
    );
  });

  it('explains when the browser could not reach the service', () => {
    expect(genericHttpErrorMessage({ status: 0 }, 'load the data')).toBe(
      'Unable to connect to the service. Check the connection and try again.',
    );
  });
});
