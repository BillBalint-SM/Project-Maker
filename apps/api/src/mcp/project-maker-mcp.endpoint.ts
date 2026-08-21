import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler, type NodeIncomingMessageLike, type NodeServerResponseLike } from '@modelcontextprotocol/node';

import { ProjectMakerMcpFacade } from './project-maker-mcp.facade';
import { createProjectMakerMcpServer } from './project-maker-mcp.server';

@Injectable()
export class ProjectMakerMcpEndpoint implements OnModuleDestroy {
  private readonly handler = createMcpHandler((context) => {
    const actorId = context.authInfo?.clientId;
    if (!actorId) {
      throw new Error('Az MCP-kéréshez nem tartozik belső felhasználó.');
    }
    return createProjectMakerMcpServer(this.facade, actorId);
  });
  private readonly nodeHandler = toNodeHandler(this.handler);

  constructor(private readonly facade: ProjectMakerMcpFacade) {}

  handle(
    request: NodeIncomingMessageLike,
    response: NodeServerResponseLike,
    parsedBody: unknown,
  ): Promise<void> {
    return this.nodeHandler(request, response, parsedBody);
  }

  onModuleDestroy(): Promise<void> {
    return this.handler.close();
  }
}
