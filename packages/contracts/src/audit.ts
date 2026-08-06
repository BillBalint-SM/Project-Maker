export interface AuditEventRecord {
  readonly projectId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly createdAt: string;
}

export interface AuditEventPage {
  readonly projectId: string;
  readonly events: readonly AuditEventRecord[];
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextOffset: number | null;
}
