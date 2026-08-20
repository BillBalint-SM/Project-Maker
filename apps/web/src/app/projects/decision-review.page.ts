import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { provideProjectOperationPolicy } from './project-operation-policy';
import { DecisionReviewComponent } from './decision-review/decision-review.component';

@Component({
  selector: 'app-decision-review-page',
  imports: [DecisionReviewComponent],
  providers: [provideProjectOperationPolicy()],
  templateUrl: './decision-review.page.html',
  styleUrl: './decision-review.page.scss',
})
export class DecisionReviewPage {
  private readonly route = inject(ActivatedRoute);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
}
