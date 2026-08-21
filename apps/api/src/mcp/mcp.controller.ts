import { All, Controller, Req, Res } from '@nestjs/common';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { Request, Response } from 'express';

import type { AuthenticatedRequest } from '../auth/auth-request';
import { McpRoute } from '../auth/mcp-route';
import { ProjectMakerMcpEndpoint } from './project-maker-mcp.endpoint';

type McpRequest = Request & AuthenticatedRequest & { auth?: AuthInfo };

@Controller('mcp')
@McpRoute()
export class McpController {
  constructor(private readonly endpoint: ProjectMakerMcpEndpoint) {}

  @All()
  handle(@Req() request: McpRequest, @Res() response: Response): Promise<void> {
    const user = request.internalUser!;
    request.auth = {
      token: 'redacted',
      clientId: user.id,
      scopes: [],
      extra: { email: user.email },
    };
    return this.endpoint.handle(request, response, request.body);
  }
}
