import { Routes } from '@angular/router';

import { requireInternalUser } from './auth/auth.guard';

const protectedRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./projects/project-list.page').then(
        (module) => module.ProjectListPage,
      ),
    title: 'Projektportfólió | Project Maker',
  },
  {
    path: 'projects/new',
    loadComponent: () =>
      import('./projects/project-create.page').then(
        (module) => module.ProjectCreatePage,
      ),
    title: 'Új projekt | Project Maker',
  },
  {
    path: 'projects/active',
    loadComponent: () =>
      import('./projects/active-project-queue.page').then(
        (module) => module.ActiveProjectQueuePageComponent,
      ),
    title: 'Aktív munkasor | Project Maker',
  },
  {
    path: 'follow-ups',
    loadComponent: () =>
      import('./projects/open-discovery-follow-ups.page').then(
        (module) => module.OpenDiscoveryFollowUpsPage,
      ),
    title: 'Tisztázandó tételek | Project Maker',
  },
  {
    path: 'customer-mail-triage',
    loadComponent: () =>
      import('./projects/customer-mail-triage.page').then(
        (module) => module.CustomerMailTriagePage,
      ),
    title: 'Nem társított ügyfélüzenetek | Project Maker',
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
        title: 'Projektállapot | Project Maker',
      },
      {
        path: 'interview',
        loadComponent: () =>
          import('./interviews/interview.page').then(
            (module) => module.InterviewPage,
          ),
        title: 'Felmérés | Project Maker',
      },
      {
        path: 'discovery',
        loadComponent: () =>
          import('./projects/discovery/discovery.page').then(
            (module) => module.DiscoveryPage,
          ),
        title: 'Felfedezések | Project Maker',
      },
      {
        path: 'readiness',
        loadComponent: () =>
          import('./projects/readiness.page').then(
            (module) => module.ReadinessPage,
          ),
        title: 'Becslési felkészültség | Project Maker',
      },
      {
        path: 'decision-review',
        loadComponent: () =>
          import('./projects/decision-review.page').then(
            (module) => module.DecisionReviewPage,
          ),
        title: 'Döntési értékelés | Project Maker',
      },
      {
        path: 'markdown',
        loadComponent: () =>
          import('./markdown/markdown.page').then(
            (module) => module.MarkdownPage,
          ),
        title: 'Projekt-specifikáció | Project Maker',
      },
      {
        path: 'delivery',
        loadComponent: () =>
          import('./projects/delivery/delivery.page').then(
            (module) => module.DeliveryPage,
          ),
        title: 'Fejlesztési csomag | Project Maker',
      },
      {
        path: 'customer-correspondences',
        loadComponent: () =>
          import('./projects/customer-correspondences.page').then(
            (module) => module.CustomerCorrespondencesPage,
          ),
        title: 'Ügyféllevelezés | Project Maker',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./projects/project-settings.page').then(
            (module) => module.ProjectSettingsPage,
          ),
        title: 'Projektbeállítások | Project Maker',
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
    title: 'Kérdésbank | Project Maker',
  },
  {
    path: 'settings/markdown-templates',
    loadComponent: () =>
      import('./settings/markdown-template.page').then(
        (module) => module.MarkdownTemplatePage,
      ),
    title: 'Specifikációs sablonok | Project Maker',
  },
  {
    path: 'settings/git-setups',
    loadComponent: () =>
      import('./settings/git-setup.page').then((module) => module.GitSetupPage),
    title: 'Git setupok | Project Maker',
  },
  {
    path: 'roadmap',
    loadComponent: () =>
      import('./projects/roadmap.page').then((module) => module.RoadmapPage),
    title: 'Üzleti roadmap | Project Maker',
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./notifications/notifications.page').then((module) => module.NotificationsPage),
    title: 'Értesítések | Project Maker',
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./auth/account.page').then((module) => module.AccountPage),
    title: 'Saját fiók | Project Maker',
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
    title: 'Ügyfél-pontosítás | Project Maker',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login.page').then((module) => module.LoginPage),
    title: 'Bejelentkezés | Project Maker',
  },
  {
    path: '',
    canActivateChild: [requireInternalUser],
    children: protectedRoutes,
  },
];
