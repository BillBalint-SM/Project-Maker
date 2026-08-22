import { Injectable } from '@nestjs/common';

const formatVersion = 1;
interface CursorEnvelope {
  readonly version: typeof formatVersion;
  readonly payload: unknown;
}

@Injectable()
export class ActiveProjectQueueCursorCodec {
  // The cursor is untrusted navigation state, not an authorization boundary.
  // Its caller validates the payload shape, filter match, and database anchor.
  seal(value: unknown): string {
    return Buffer.from(
      JSON.stringify({ version: formatVersion, payload: value } satisfies CursorEnvelope),
      'utf8',
    ).toString('base64url');
  }

  open(raw: string): unknown {
    let envelope: unknown;
    try {
      const decoded = Buffer.from(raw, 'base64url').toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64url') !== raw) {
        throw new TypeError('Invalid cursor envelope.');
      }
      envelope = JSON.parse(decoded) as unknown;
    } catch {
      throw new TypeError('Invalid cursor envelope.');
    }
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      (envelope as Partial<CursorEnvelope>).version !== formatVersion ||
      !Object.hasOwn(envelope, 'payload')
    ) {
      throw new TypeError('Invalid cursor envelope.');
    }
    return (envelope as CursorEnvelope).payload;
  }
}
