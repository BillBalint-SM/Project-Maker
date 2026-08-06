const invalidCorsOriginMessage =
  'CORS_ORIGIN must be one exact HTTP(S) origin without a wildcard, path, credentials, query, or fragment.';

export function validateCorsOrigin(origin: string | undefined): string {
  if (!origin || !URL.canParse(origin)) {
    throw new Error(invalidCorsOriginMessage);
  }

  const parsedOrigin = new URL(origin);
  const usesHttp = parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:';
  const isExactOrigin = origin === parsedOrigin.origin;

  if (!usesHttp || !isExactOrigin) {
    throw new Error(invalidCorsOriginMessage);
  }

  return parsedOrigin.origin;
}
