export const notificationKinds = [
  'PROJECT_OVERDUE',
  'PROJECT_DUE',
  'CUSTOMER_REPLY',
  'CUSTOMER_RESPONSE',
  'CUSTOMER_DELIVERY_FAILURE',
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

export type NotificationSeverity = 'CRITICAL' | 'ACTION_REQUIRED' | 'UPCOMING';

export interface InternalNotification {
  readonly key: string;
  readonly kind: NotificationKind;
  readonly severity: NotificationSeverity;
  readonly projectId: string;
  readonly projectName: string;
  readonly reason: string;
  readonly attentionAt: string;
  readonly actionUrl: string;
}

export interface NotificationList {
  readonly items: readonly InternalNotification[];
  readonly totalCount: number;
  readonly limit: 25;
}
