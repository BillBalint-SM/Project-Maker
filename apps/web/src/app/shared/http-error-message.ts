export function genericHttpErrorMessage(
  error: unknown,
  action: string,
  fallback?: string,
): string {
  if (isNetworkError(error)) {
    return 'Nem sikerült kapcsolódni a szolgáltatáshoz. Ellenőrizd a kapcsolatot, majd próbáld újra.';
  }
  return fallback ?? `Nem sikerült ${action}. Próbáld meg újra.`;
}

function isNetworkError(value: unknown): value is { readonly status: number } {
  return value !== null && typeof value === 'object' && (value as { status?: unknown }).status === 0;
}
