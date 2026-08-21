export interface DeliveryPackageItemInput {
  readonly id?: string;
  readonly title: string;
  readonly userStory: string;
  readonly acceptanceCriteria: readonly string[];
  readonly sourceExcerpts?: readonly string[];
}

export interface DeliveryPackageItem extends DeliveryPackageItemInput {
  readonly id: string;
  readonly sourceExcerpts: readonly string[];
}

export interface SaveDeliveryPackageInput {
  readonly specificationRevisionId: string;
  readonly items: readonly DeliveryPackageItemInput[];
}

export interface DeliveryPackageProvenance {
  readonly state: 'DRAFT' | 'HANDED_OFF';
  readonly commitSha: string | null;
  readonly handedOffAt: string | null;
}

export interface DeliveryPackage {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly version: number;
  readonly specification: {
    readonly id: string;
    readonly version: number;
    readonly createdAt: string;
  };
  readonly items: readonly DeliveryPackageItem[];
  readonly provenance: DeliveryPackageProvenance;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface DeliveryPackageArtifact {
  readonly filename: string;
  readonly mediaType: 'text/markdown';
  readonly content: string;
  readonly digest: string;
  readonly provenance: DeliveryPackageProvenance;
}

export const gitAuthenticationModes = ['HTTPS_TOKEN', 'SSH_KEY'] as const;
export type GitAuthenticationMode = (typeof gitAuthenticationModes)[number];

export interface GitCredentialInput {
  readonly accessToken?: string;
  readonly privateKey?: string;
  readonly passphrase?: string | null;
}

export interface SaveGitSetupInput {
  readonly name: string;
  readonly remoteUrl: string;
  readonly branch: string;
  readonly authenticationMode: GitAuthenticationMode;
  readonly username?: string | null;
  readonly credential?: GitCredentialInput;
  readonly repositoryWebUrl?: string | null;
}

export interface GitSetup {
  readonly id: string;
  readonly name: string;
  readonly remoteUrl: string;
  readonly branch: string;
  readonly authenticationMode: GitAuthenticationMode;
  readonly username: string | null;
  readonly credentialConfigured: boolean;
  readonly repositoryWebUrl: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface GitConnectionTestResult {
  readonly ok: boolean;
  readonly checkedAt: string;
  readonly message: string;
}

export interface PreviewDeliveryHandoffInput {
  readonly gitSetupId: string;
}

export interface DeliveryHandoffPreview {
  readonly previewToken: string;
  readonly expiresAt: string;
  readonly setup: Pick<GitSetup, 'id' | 'name' | 'remoteUrl' | 'branch' | 'repositoryWebUrl' | 'version'>;
  readonly packageVersion: number;
  readonly artifactPath: string;
  readonly commitMessage: string;
  readonly artifact: DeliveryPackageArtifact;
}

export interface ConfirmDeliveryHandoffInput {
  readonly previewToken: string;
}

export const deliveryHandoffStates = ['PENDING', 'PUSHING', 'SENT', 'FAILED', 'CONFLICT'] as const;
export type DeliveryHandoffState = (typeof deliveryHandoffStates)[number];

export interface DeliveryHandoff {
  readonly id: string;
  readonly projectId: string;
  readonly packageVersion: number;
  readonly setupName: string;
  readonly remoteUrl: string;
  readonly branch: string;
  readonly artifactPath: string;
  readonly artifactDigest: string;
  readonly state: DeliveryHandoffState;
  readonly expectedCommitSha: string | null;
  readonly commitSha: string | null;
  readonly repositoryBacklink: string | null;
  readonly failureCode: string | null;
  readonly attemptCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
