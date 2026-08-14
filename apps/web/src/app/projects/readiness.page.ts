import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ReadinessReviewComponent } from './readiness-review/readiness-review.component';

@Component({
  selector: 'app-readiness-page',
  imports: [ReadinessReviewComponent, RouterLink],
  templateUrl: './readiness.page.html',
  styleUrl: './readiness.page.scss',
})
export class ReadinessPage {
  private readonly route = inject(ActivatedRoute);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
}
