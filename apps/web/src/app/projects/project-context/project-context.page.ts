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
  { key: 'status', label: 'Project Status', path: 'status' },
  { key: 'interview', label: 'Initial Intake', path: 'interview' },
  { key: 'discovery', label: 'Discovery', path: 'discovery' },
  { key: 'readiness', label: 'Estimation Readiness', path: 'readiness' },
  { key: 'decision-review', label: 'Decision Review', path: 'decision-review' },
  { key: 'markdown', label: 'Project Specification', path: 'markdown' },
  { key: 'delivery', label: 'Delivery Package', path: 'delivery' },
  { key: 'settings', label: 'Project Settings', path: 'settings' },
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
  private readonly currentLocation = signal<ProjectContextLocation | null>(null);

  readonly context = inject(ProjectContextState);
  readonly projectId = signal('');
  readonly returnTarget = signal('/');
  readonly contextLinks = projectContextLinks;
  readonly linkMatchOptions = contextLinkMatchOptions;
  readonly returnLink = computed(() => this.router.parseUrl(this.returnTarget()));
  readonly returnLabel = computed(() => {
    const target = this.returnTarget();
    if (target.startsWith('/projects/active')) {
      return 'Back to Active Project Queue';
    }
    if (target === '/follow-ups') {
      return 'Back to Discovery Follow-ups';
    }
    return 'Back to Portfolio Overview';
  });
  readonly contextQueryParams = computed(() => ({ returnTo: this.returnTarget() }));
  readonly preparationMapQueryParams = computed(() => ({
    view: 'preparation-lifecycle',
    returnTo: this.selectedProjectReturnTarget(),
  }));
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
          const location = {
            projectId,
            page: this.route.firstChild?.snapshot.url
              .map((segment) => segment.path)
              .join('/') ?? '',
          };
          this.previousLocation = location;
          this.currentLocation.set(location);
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
        this.currentLocation.set(location);
        if (previous?.projectId === location.projectId && previous.page !== location.page) {
          this.context.reload();
        }
      });
  }

  contextRoute(path: string): readonly string[] {
    return ['/projects', this.projectId(), path];
  }

  private selectedProjectReturnTarget(): string {
    const location = this.currentLocation();
    if (!location?.projectId || !location.page) {
      return '/';
    }
    const queryParams =
      this.returnTarget() === '/' ? undefined : { returnTo: this.returnTarget() };
    return this.router.serializeUrl(
      this.router.createUrlTree(['/projects', location.projectId, location.page], {
        queryParams,
      }),
    );
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
