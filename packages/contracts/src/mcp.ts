export interface McpConnectionStatus {
  readonly configured: boolean;
  readonly createdAt: string | null;
}

export interface McpConnectionToken {
  readonly token: string;
  readonly createdAt: string;
}
