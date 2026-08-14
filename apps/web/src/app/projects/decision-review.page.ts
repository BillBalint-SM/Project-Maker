import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { provideCockpitOperationPolicy } from './cockpit-operation-policy';
import { DecisionReviewComponent } from './decision-review/decision-review.component';

@Component({
  selector: 'app-decision-review-page',
  imports: [DecisionReviewComponent, RouterLink],
  providers: [provideCockpitOperationPolicy()],
  templateUrl: './decision-review.page.html',
  styleUrl: './decision-review.page.scss',
})
export class DecisionReviewPage {
  private readonly route = inject(ActivatedRoute);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
}
