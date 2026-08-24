import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { McpConnectionStatus, McpConnectionToken } from '@project-maker/contracts';

import {
  sessionCookieName,
  sessionTokenFrom,
  shouldBypassAuthenticationInTests,
  testInternalUser,
} from './auth.constants';
import type { AuthenticatedRequest, InternalUserView } from './auth-request';
import { AuthService, type AuthResult } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CredentialsDto } from './dto/credentials.dto';
import { PublicRoute } from './public-route';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('signup')
  @PublicRoute()
  async signUp(
    @Body() input: CredentialsDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<InternalUserView> {
    return this.finishAuthentication(await this.auth.signUp(input.email, input.password), response);
  }

  @Post('login')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: CredentialsDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<InternalUserView> {
    return this.finishAuthentication(await this.auth.login(input.email, input.password), response);
  }

  @Get('session')
  @PublicRoute()
  session(@Req() request: AuthenticatedRequest): InternalUserView | null {
    if (shouldBypassAuthenticationInTests()) {
      return testInternalUser;
    }
    return request.internalUser ?? null;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<void> {
    const token = sessionTokenFrom(request);
    if (token) {
      await this.auth.logout(token);
    }
    this.clearSessionCookie(response);
  }

  @Get('mcp-connection')
  mcpConnectionStatus(
    @Req() request: AuthenticatedRequest,
  ): Promise<McpConnectionStatus> {
    return this.auth.mcpConnectionStatus(request.internalUser!.id);
  }

  @Post('mcp-connection')
  createMcpConnection(
    @Req() request: AuthenticatedRequest,
  ): Promise<McpConnectionToken> {
    return this.auth.createMcpConnection(request.internalUser!.id);
  }

  @Delete('mcp-connection')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeMcpConnection(@Req() request: AuthenticatedRequest): Promise<void> {
    return this.auth.revokeMcpConnection(request.internalUser!.id);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<InternalUserView> {
    return this.finishAuthentication(
      await this.auth.changePassword(
        request.internalUser!.id,
        input.currentPassword,
        input.newPassword,
      ),
      response,
    );
  }

  @Post('deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<void> {
    await this.auth.deactivate(request.internalUser!.id);
    this.clearSessionCookie(response);
  }

  @Post('restore')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  async restore(
    @Body() input: CredentialsDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<InternalUserView> {
    return this.finishAuthentication(await this.auth.restore(input.email, input.password), response);
  }

  private finishAuthentication(result: AuthResult, response: HeaderResponse): InternalUserView {
    response.setHeader('Set-Cookie', this.sessionCookie(result.token));
    return result.user;
  }

  private clearSessionCookie(response: HeaderResponse): void {
    response.setHeader(
      'Set-Cookie',
      `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${this.secureCookieSuffix()}`,
    );
  }

  private sessionCookie(token: string): string {
    const maxAgeSeconds = 7 * 24 * 60 * 60;
    return `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${this.secureCookieSuffix()}`;
  }

  private secureCookieSuffix(): string {
    const origin = this.config.get<string>('CORS_ORIGIN');
    const hostname = origin && URL.canParse(origin) ? new URL(origin).hostname : '';
    return ['localhost', '127.0.0.1', '::1'].includes(hostname) ? '' : '; Secure';
  }
}
