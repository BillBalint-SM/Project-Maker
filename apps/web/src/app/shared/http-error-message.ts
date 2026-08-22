export function genericHttpErrorMessage(
  error: unknown,
  action: string,
  fallback?: string,
): string {
  if (isNetworkError(error)) {
    return 'Unable to connect to the service. Check the connection and try again.';
  }
  return fallback ?? `Unable to ${action}. Try again.`;
}

function isNetworkError(value: unknown): value is { readonly status: number } {
  return value !== null && typeof value === 'object' && (value as { status?: unknown }).status === 0;
}
