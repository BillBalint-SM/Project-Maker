import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CustomerCorrespondenceView } from '@project-maker/contracts';

@Component({
  selector: 'app-discovery-reply-outcome',
  imports: [RouterLink],
  template: `
    @if (sourceFollowUp(); as source) {
      <a [routerLink]="['/projects', projectId(), 'readiness']"
        [queryParams]="{
          reviewFollowUpId: source.followUpId,
          reviewFollowUpVersion: source.followUpVersion,
          reviewCorrespondenceId: correspondence().id
        }"
        queryParamsHandling="merge"
        [fragment]="'discovery-follow-up-' + source.followUpId"
        [attr.data-testid]="'review-ping-source-' + correspondence().id">Forrás Discovery follow-up áttekintése</a>
    }
  `,
})
export class DiscoveryReplyOutcomeComponent {
  readonly projectId = input.required<string>();
  readonly correspondence = input.required<CustomerCorrespondenceView>();

  sourceFollowUp(): { followUpId: string; followUpVersion: number } | null {
    const correspondence = this.correspondence();
    const source = correspondence.source;
    if (
      correspondence.messages.length === 0
      || source.type !== 'CUSTOMER_FOLLOW_UP_PING'
      || source.followUpId === null
      || source.followUpVersion === null
    ) return null;
    return { followUpId: source.followUpId, followUpVersion: source.followUpVersion };
  }
}
