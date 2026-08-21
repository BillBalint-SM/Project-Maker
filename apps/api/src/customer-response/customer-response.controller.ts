import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CustomerResponseEligiblePrompt,
  CustomerResponseRequest,
  CustomerResponseRequestPreview,
  CustomerResponseSubmissionReceipt,
  Evidence,
  PublicCustomerResponseRequest,
} from '@project-maker/contracts';
import type { Request, Response } from 'express';

import { CustomerPublicRoute } from '../auth/public-route';
import { CustomerResponseService } from './customer-response.service';
import {
  ConfirmCustomerResponseRequestDto,
  ExchangeCustomerResponseCapabilityDto,
  PreviewCustomerResponseRequestDto,
  SubmitCustomerResponseDto,
} from './dto/customer-response.dto';

@Controller('projects/:projectId/customer-response-requests')
export class CustomerResponseInternalController {
  constructor(private readonly service: CustomerResponseService) {}

  @Get('eligible-prompts')
  eligible(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly CustomerResponseEligiblePrompt[]> {
    return this.service.eligiblePrompts(projectId);
  }

  @Post('preview')
  preview(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: PreviewCustomerResponseRequestDto,
  ): Promise<CustomerResponseRequestPreview> {
    return this.service.preview(projectId, input);
  }

  @Post('confirm')
  confirm(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: ConfirmCustomerResponseRequestDto,
  ): Promise<CustomerResponseRequest> {
    return this.service.confirm(projectId, input);
  }

  @Get()
  list(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly CustomerResponseRequest[]> {
    return this.service.list(projectId);
  }

  @Post(':requestId/retry')
  retry(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<CustomerResponseRequest> {
    return this.service.retry(projectId, requestId);
  }

  @Post(':requestId/revoke')
  revoke(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<CustomerResponseRequest> {
    return this.service.revoke(projectId, requestId);
  }

  @Post(':requestId/review')
  review(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<CustomerResponseRequest> {
    return this.service.review(projectId, requestId);
  }

  @Post(':requestId/answers/:answerId/evidence')
  evidence(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Param('answerId', new ParseUUIDPipe()) answerId: string,
  ): Promise<Evidence> {
    return this.service.answerEvidence(projectId, requestId, answerId);
  }
}

@CustomerPublicRoute()
@Controller('public/customer-response')
export class CustomerResponsePublicController {
  constructor(
    private readonly service: CustomerResponseService,
    private readonly config: ConfigService,
  ) {}

  @Post('exchange')
  async exchange(
    @Body() input: ExchangeCustomerResponseCapabilityDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ readonly available: true }> {
    publicHeaders(response);
    await this.service.exchange(input.token, clientIp(request));
    response.cookie('pm_customer_response', input.token, {
      httpOnly: true,
      secure: this.config.get<string>('CUSTOMER_RESPONSE_ORIGIN')?.startsWith('https://') ?? true,
      sameSite: 'strict',
      path: '/api/public/customer-response',
      maxAge: 14 * 24 * 60 * 60 * 1_000,
    });
    return { available: true };
  }

  @Get()
  get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicCustomerResponseRequest> {
    publicHeaders(response);
    return this.service.publicRequest(requireCapabilityCookie(request), clientIp(request));
  }

  @Post('submit')
  submit(
    @Body() input: SubmitCustomerResponseDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerResponseSubmissionReceipt> {
    publicHeaders(response);
    return this.service.submit(requireCapabilityCookie(request), clientIp(request), input);
  }
}

function requireCapabilityCookie(request: Request): string {
  const header = request.headers.cookie ?? '';
  for (const item of header.split(';')) {
    const [name, ...value] = item.trim().split('=');
    if (name === 'pm_customer_response' && value.length > 0) return value.join('=');
  }
  return '';
}

function clientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function publicHeaders(response: Response): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}
