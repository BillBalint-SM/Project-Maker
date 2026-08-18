import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  ActiveProjectQueueItem,
  ActiveProjectQueuePage,
  ActiveProjectUrgency,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { ActiveProjectQueueApiService } from './active-project-queue-api.service';
import { projectActionRoute } from './project-action-route';

const urgencyOrder: readonly ActiveProjectUrgency[] = [
  'CUSTOMER_REPLY',
  'OVERDUE',
  'DUE_SOON',
  'IN_PROGRESS',
];

interface QueueGroup {
  readonly urgency: ActiveProjectUrgency;
  readonly label: string;
  readonly items: readonly ActiveProjectQueueItem[];
}

@Component({
  selector: 'app-active-project-queue-page',
  imports: [ButtonModule, DatePipe, ProgressSpinnerModule, RouterLink, TagModule],
  templateUrl: './active-project-queue.page.html',
  styleUrl: './active-project-queue.page.scss',
})
export class ActiveProjectQueuePageComponent implements OnInit {
  private readonly api = inject(ActiveProjectQueueApiService);

  readonly page = signal<ActiveProjectQueuePage | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly groups = computed<readonly QueueGroup[]>(() => {
    const items = this.page()?.items ?? [];
    return urgencyOrder.flatMap((urgency) => {
      const groupItems = items.filter((item) => item.urgency === urgency);
      return groupItems.length === 0
        ? []
        : [{ urgency, label: groupItems[0].urgencyLabel, items: groupItems }];
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.firstPage().subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  projectRoute(projectId: string): readonly string[] {
    return ['/projects', projectId, 'status'];
  }

  actionRoute(item: ActiveProjectQueueItem): readonly string[] {
    return projectActionRoute(item.projectId, item.primaryAction.target);
  }
}
