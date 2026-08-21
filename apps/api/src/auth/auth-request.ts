export interface InternalUserView {
  readonly id: string;
  readonly email: string;
}

export interface AuthenticatedRequest {
  readonly method: string;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  internalUser?: InternalUserView;
}
