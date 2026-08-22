import { describe, expect, it } from 'vitest';

import { genericHttpErrorMessage } from './http-error-message';

describe('genericHttpErrorMessage', () => {
  it('uses controlled Hungarian copy instead of an arbitrary server message', () => {
    const error = {
      status: 500,
      error: { message: 'internal diagnostic must not reach the UI' },
    };

    expect(genericHttpErrorMessage(error, 'menteni az adatot')).toBe(
      'Nem sikerült menteni az adatot. Próbáld meg újra.',
    );
  });

  it('explains when the browser could not reach the service', () => {
    expect(genericHttpErrorMessage({ status: 0 }, 'betölteni az adatot')).toBe(
      'Nem sikerült kapcsolódni a szolgáltatáshoz. Ellenőrizd a kapcsolatot, majd próbáld újra.',
    );
  });
});
