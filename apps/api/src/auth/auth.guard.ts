import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { setCurrentAuditActor } from '../audit/audit-actor';
import {
  mcpTokenFrom,
  sessionTokenFrom,
  shouldBypassAuthenticationInTests,
} from './auth.constants';
import type { AuthenticatedRequest } from './auth-request';
import { AuthService } from './auth.service';
import { mcpRouteMetadata } from './mcp-route';
import { customerPublicRouteMetadata, publicRouteMetadata } from './public-route';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isMcpRoute = this.reflector.getAllAndOverride<boolean>(mcpRouteMetadata, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (isMcpRoute) {
      const token = mcpTokenFrom(request);
      const user = token ? await this.auth.resolveMcpToken(token) : null;
      if (!user) {
        throw new UnauthorizedException('Érvényes Project Maker MCP-token szükséges.');
      }
      request.internalUser = user;
      setCurrentAuditActor(user.id);
      return true;
    }

    const isCustomerPublic = this.reflector.getAllAndOverride<boolean>(customerPublicRouteMetadata, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isCustomerPublic && isUnsafeMethod(request.method)) {
      const origin = request.headers['origin'];
      const allowedOrigin = this.config.get<string>('CUSTOMER_RESPONSE_ORIGIN');
      if (!allowedOrigin || typeof origin !== 'string' || origin !== allowedOrigin) {
        throw new ForbiddenException('A kérés forrása nem engedélyezett.');
      }
    }
    if (shouldBypassAuthenticationInTests()) {
      return true;
    }

    if (!isCustomerPublic && isUnsafeMethod(request.method)) {
      const origin = request.headers['origin'];
      if (typeof origin !== 'string' || origin !== this.config.get<string>('CORS_ORIGIN')) {
        throw new ForbiddenException('A kérés forrása nem engedélyezett.');
      }
    }

    const token = sessionTokenFrom(request);
    const user = token ? await this.auth.resolveSession(token) : null;
    request.internalUser = user ?? undefined;
    if (user) {
      setCurrentAuditActor(user.id);
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(publicRouteMetadata, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || isCustomerPublic || user) {
      return true;
    }
    throw new UnauthorizedException('A folytatáshoz bejelentkezés szükséges.');
  }
}

function isUnsafeMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}
