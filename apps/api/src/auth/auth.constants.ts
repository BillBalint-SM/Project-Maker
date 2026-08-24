import type { AuthenticatedRequest, InternalUserView } from './auth-request';

export const sessionCookieName = 'pm_session';
export const testInternalUser: InternalUserView = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'e2e-user@example.test',
};

export function sessionTokenFrom(request: AuthenticatedRequest): string | null {
  const cookieHeader = request.headers['cookie'];
  if (typeof cookieHeader !== 'string') {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator > 0 && cookie.slice(0, separator).trim() === sessionCookieName) {
      return cookie.slice(separator + 1).trim() || null;
    }
  }
  return null;
}

export function mcpTokenFrom(request: AuthenticatedRequest): string | null {
  const authorization = request.headers['authorization'];
  if (typeof authorization !== 'string') {
    return null;
  }
  const match = authorization.match(/^Bearer\s+(pm_mcp_[A-Za-z0-9_-]+)$/i);
  return match?.[1] ?? null;
}

export function shouldBypassAuthenticationInTests(): boolean {
  const isTestRuntime =
    process.env['NODE_ENV'] === 'test' || process.env['NODE_TEST_CONTEXT'] !== undefined;
  return isTestRuntime && process.env['AUTH_TEST_ENFORCEMENT'] !== 'true';
}
