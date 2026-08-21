import { SetMetadata } from '@nestjs/common';

export const mcpRouteMetadata = 'project-maker:mcp-route';
export const McpRoute = () => SetMetadata(mcpRouteMetadata, true);
