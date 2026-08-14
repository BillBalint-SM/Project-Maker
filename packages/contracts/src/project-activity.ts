export interface ProjectActivityItem {
  readonly occurredAt: string;
  readonly summary: string;
}

export interface ProjectActivityFeed {
  readonly projectId: string;
  readonly events: readonly ProjectActivityItem[];
}
