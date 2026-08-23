import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AppThemeState } from '../theme/app-theme.state';
import { validatedWorkspaceMapReturnTarget } from './workspace-map-return-target';

type WorkspaceMap = {
  readonly id:
    | 'user-workflow'
    | 'preparation-lifecycle'
    | 'customer-communication'
    | 'feature-dataflow'
    | 'architecture';
  readonly index: string;
  readonly label: string;
  readonly title: string;
  readonly perspective: string;
  readonly description: string;
  readonly file: string;
};

const workspaceMaps = [
  {
    id: 'user-workflow',
    index: '01',
    label: 'User workflow',
    title: 'Project Preparation Journey',
    perspective: 'Internal user journey',
    description:
      'Follow work from Portfolio Overview and New project through Initial Intake, Estimation Readiness, Project Specification, Customer correspondence, and the exact-preview Git handoff.',
    file: 'project-maker-user-workflow.html',
  },
  {
    id: 'preparation-lifecycle',
    index: '02',
    label: 'Preparation lifecycle',
    title: 'Preparation State Decision Logic',
    perspective: 'Lifecycle and state logic',
    description:
      'See how the Project question schema, current Initial Intake, Estimation Readiness, and Decision Review produce the server-derived preparation state while administrative phase, urgency, and archive remain separate dimensions.',
    file: 'project-maker-preparation-lifecycle.html',
  },
  {
    id: 'customer-communication',
    index: '03',
    label: 'Customer communication',
    title: 'Customer Correspondence Send and Reply Flow',
    perspective: 'Sequence and trust boundaries',
    description:
      'Trace preview, explicit Send to Customer confirmation, retained summaries, Operator mail-gateway delivery, reply correlation, and Internal user processing.',
    file: 'project-maker-customer-communication.html',
  },
  {
    id: 'feature-dataflow',
    index: '04',
    label: 'Feature and data flow',
    title: 'Feature and Dataflow Map',
    perspective: 'Features, records, and outputs',
    description:
      'Connect versioned sources, Project intake, discovery evidence, derived decision support, immutable outputs, and controlled external handoffs.',
    file: 'project-maker-feature-dataflow.html',
  },
  {
    id: 'architecture',
    index: '05',
    label: 'Runtime architecture',
    title: 'Runtime Architecture',
    perspective: 'Systems and deployment boundaries',
    description:
      'Inspect the VPN-bounded web, API, persistence, Operator mail gateway, Customer response, Git, and Claude Code MCP boundaries with verified source references.',
    file: 'project-maker-architecture.html',
  },
] as const satisfies readonly WorkspaceMap[];

@Component({
  selector: 'app-workspace-map-page',
  imports: [RouterLink],
  templateUrl: './workspace-map.page.html',
  styleUrl: './workspace-map.page.scss',
})
export class WorkspaceMapPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly appTheme = inject(AppThemeState);
  private readonly requestedView = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('view'))),
    { initialValue: null },
  );
  private readonly requestedReturnTarget = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('returnTo'))),
    { initialValue: null },
  );

  readonly maps = workspaceMaps;
  readonly theme = this.appTheme.theme;
  readonly activeMap = computed<WorkspaceMap>(() => {
    const requested = this.requestedView();
    return workspaceMaps.find((entry) => entry.id === requested) ?? workspaceMaps[0];
  });
  readonly returnTarget = computed(() =>
    validatedWorkspaceMapReturnTarget(this.requestedReturnTarget()),
  );
  readonly returnLabel = computed(() =>
    this.returnTarget() === '/' ? 'Back to Portfolio Overview' : 'Back to selected Project',
  );
  readonly returnLink = computed(() => this.router.parseUrl(this.returnTarget()));
  readonly fullMapUrl = computed(
    () => `/diagrams/${this.activeMap().file}?theme=${this.theme()}`,
  );
  readonly embeddedMapUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      `/diagrams/${this.activeMap().file}?embed=1&theme=${this.theme()}`,
    ),
  );

  mapQueryParams(id: WorkspaceMap['id']): { view: WorkspaceMap['id']; returnTo?: string } {
    const returnTarget = this.returnTarget();
    return returnTarget === '/' ? { view: id } : { view: id, returnTo: returnTarget };
  }
}
