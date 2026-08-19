import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  IsActiveMatchOptions,
  NavigationEnd,
  PRIMARY_OUTLET,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { distinctUntilChanged, filter, map } from 'rxjs';

import { projectActionFragment, projectActionRoute } from '../project-action-route';
import { ProjectContextState } from './project-context.state';
import { validatedProjectReturnTarget } from './project-return-target';

const projectContextLinks = [
  { key: 'status', label: 'Projektállapot', path: 'status' },
  { key: 'interview', label: 'Felmérés', path: 'interview' },
  { key: 'readiness', label: 'Felkészültség', path: 'readiness' },
  { key: 'decision-review', label: 'Döntési értékelés', path: 'decision-review' },
  { key: 'markdown', label: 'Markdown terv', path: 'markdown' },
  { key: 'settings', label: 'Projektbeállítások', path: null },
] as const;

const contextLinkMatchOptions: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

type ProjectContextLocation = {
  readonly projectId: string;
  readonly page: string;
};

@Component({
  selector: 'app-project-context-page',
  imports: [
    ButtonModule,
    ProgressSpinnerModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TagModule,
  ],
  providers: [ProjectContextState],
  templateUrl: './project-context.page.html',
  styleUrl: './project-context.page.scss',
})
export class ProjectContextPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private previousLocation: ProjectContextLocation | null = null;

  readonly context = inject(ProjectContextState);
  readonly projectId = signal('');
  readonly returnTarget = signal('/');
  readonly contextLinks = projectContextLinks;
  readonly linkMatchOptions = contextLinkMatchOptions;
  readonly returnLink = computed(() => this.router.parseUrl(this.returnTarget()));
  readonly returnLabel = computed(() =>
    this.returnTarget().startsWith('/projects/active')
      ? 'Vissza az aktív munkasorhoz'
      : 'Vissza a portfólióhoz',
  );
  readonly contextQueryParams = computed(() => ({ returnTo: this.returnTarget() }));
  readonly primaryActionRoute = computed(() => {
    const workState = this.context.workState();
    return workState
      ? projectActionRoute(workState.projectId, workState.primaryAction.target)
      : null;
  });
  readonly primaryActionFragment = computed(() => {
    const workState = this.context.workState();
    return workState ? projectActionFragment(workState.primaryAction.target) : undefined;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('projectId') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((projectId) => {
        this.projectId.set(projectId);
        if (this.previousLocation?.projectId !== projectId) {
          this.previousLocation = {
            projectId,
            page: this.route.firstChild?.snapshot.url
              .map((segment) => segment.path)
              .join('/') ?? '',
          };
        }
        this.context.load(projectId);
      });

    this.route.queryParamMap
      .pipe(
        map((params) => validatedProjectReturnTarget(params.get('returnTo'))),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((returnTarget) => this.returnTarget.set(returnTarget));

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        map((event) => projectContextLocation(this.router, event.urlAfterRedirects)),
        filter((location): location is ProjectContextLocation => location !== null),
        distinctUntilChanged(
          (previous, current) =>
            previous.projectId === current.projectId && previous.page === current.page,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((location) => {
        const previous = this.previousLocation;
        this.previousLocation = location;
        if (previous?.projectId === location.projectId && previous.page !== location.page) {
          this.context.reload();
        }
      });
  }

  contextRoute(path: string | null): readonly string[] {
    return path
      ? ['/projects', this.projectId(), path]
      : ['/projects', this.projectId()];
  }
}

function projectContextLocation(router: Router, url: string): ProjectContextLocation | null {
  const segments = router.parseUrl(url).root.children[PRIMARY_OUTLET]?.segments ?? [];
  if (segments[0]?.path !== 'projects' || !segments[1]?.path) {
    return null;
  }
  return {
    projectId: segments[1].path,
    page: segments.slice(2).map((segment) => segment.path).join('/'),
  };
}
