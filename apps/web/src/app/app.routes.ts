import { Routes } from '@angular/router';

import { requireInternalUser } from './auth/auth.guard';

const protectedRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./projects/project-list.page').then(
        (module) => module.ProjectListPage,
      ),
    title: 'Portfolio | Project Maker',
  },
  {
    path: 'projects/new',
    loadComponent: () =>
      import('./projects/project-create.page').then(
        (module) => module.ProjectCreatePage,
      ),
    title: 'New project | Project Maker',
  },
  {
    path: 'projects/active',
    loadComponent: () =>
      import('./projects/active-project-queue.page').then(
        (module) => module.ActiveProjectQueuePageComponent,
      ),
    title: 'Active project queue | Project Maker',
  },
  {
    path: 'follow-ups',
    loadComponent: () =>
      import('./projects/open-discovery-follow-ups.page').then(
        (module) => module.OpenDiscoveryFollowUpsPage,
      ),
    title: 'Discovery follow-ups | Project Maker',
  },
  {
    path: 'customer-mail-triage',
    loadComponent: () =>
      import('./projects/customer-mail-triage.page').then(
        (module) => module.CustomerMailTriagePage,
      ),
    title: 'Unmatched Customer messages | Project Maker',
  },
  {
    path: 'projects/:projectId',
    loadComponent: () =>
      import('./projects/project-context/project-context.page').then(
        (module) => module.ProjectContextPage,
      ),
    children: [
      {
        path: 'status',
        loadComponent: () =>
          import('./projects/project-status.page').then(
            (module) => module.ProjectStatusPage,
          ),
        title: 'Project status | Project Maker',
      },
      {
        path: 'interview',
        loadComponent: () =>
          import('./interviews/interview.page').then(
            (module) => module.InterviewPage,
          ),
        title: 'Initial Intake | Project Maker',
      },
      {
        path: 'discovery',
        loadComponent: () =>
          import('./projects/discovery/discovery.page').then(
            (module) => module.DiscoveryPage,
          ),
        title: 'Discovery | Project Maker',
      },
      {
        path: 'readiness',
        loadComponent: () =>
          import('./projects/readiness.page').then(
            (module) => module.ReadinessPage,
          ),
        title: 'Estimation readiness | Project Maker',
      },
      {
        path: 'decision-review',
        loadComponent: () =>
          import('./projects/decision-review.page').then(
            (module) => module.DecisionReviewPage,
          ),
        title: 'Decision Review | Project Maker',
      },
      {
        path: 'markdown',
        loadComponent: () =>
          import('./markdown/markdown.page').then(
            (module) => module.MarkdownPage,
          ),
        title: 'Project specification | Project Maker',
      },
      {
        path: 'delivery',
        loadComponent: () =>
          import('./projects/delivery/delivery.page').then(
            (module) => module.DeliveryPage,
          ),
        title: 'Delivery package | Project Maker',
      },
      {
        path: 'customer-correspondences',
        loadComponent: () =>
          import('./projects/customer-correspondences.page').then(
            (module) => module.CustomerCorrespondencesPage,
          ),
        title: 'Customer correspondence | Project Maker',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./projects/project-settings.page').then(
            (module) => module.ProjectSettingsPage,
          ),
        title: 'Project settings | Project Maker',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'status',
      },
    ],
  },
  {
    path: 'settings/questions',
    loadComponent: () =>
      import('./settings/question-bank.page').then(
        (module) => module.QuestionBankPage,
      ),
    title: 'Question Bank | Project Maker',
  },
  {
    path: 'settings/markdown-templates',
    loadComponent: () =>
      import('./settings/markdown-template.page').then(
        (module) => module.MarkdownTemplatePage,
      ),
    title: 'Specification templates | Project Maker',
  },
  {
    path: 'settings/git-setups',
    loadComponent: () =>
      import('./settings/git-setup.page').then((module) => module.GitSetupPage),
    title: 'Git connections | Project Maker',
  },
  {
    path: 'roadmap',
    loadComponent: () =>
      import('./projects/roadmap.page').then((module) => module.RoadmapPage),
    title: 'Business roadmap | Project Maker',
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./notifications/notifications.page').then((module) => module.NotificationsPage),
    title: 'Notifications | Project Maker',
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./auth/account.page').then((module) => module.AccountPage),
    title: 'My account | Project Maker',
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export const routes: Routes = [
  {
    path: 'respond',
    loadComponent: () =>
      import('./customer-response/public-customer-response.page').then(
        (module) => module.PublicCustomerResponsePage,
      ),
    title: 'Customer clarification | Project Maker',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login.page').then((module) => module.LoginPage),
    title: 'Sign in | Project Maker',
  },
  {
    path: '',
    canActivateChild: [requireInternalUser],
    children: protectedRoutes,
  },
];
