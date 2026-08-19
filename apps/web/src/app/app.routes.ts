import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./projects/project-list.page').then(
        (module) => module.ProjectListPage,
      ),
    title: 'Áttekintő | Project Maker',
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
    title: 'Folyamatban lévő ügyek | Project Maker',
  },
  {
    path: 'follow-ups',
    loadComponent: () =>
      import('./projects/open-discovery-follow-ups.page').then(
        (module) => module.OpenDiscoveryFollowUpsPage,
      ),
    title: 'Utánkövetések | Project Maker',
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
        path: 'readiness',
        loadComponent: () =>
          import('./projects/readiness.page').then(
            (module) => module.ReadinessPage,
          ),
        title: 'Felkészültség | Project Maker',
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
        title: 'Markdown terv | Project Maker',
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
    title: 'Kérdésbank beállítások | Project Maker',
  },
  {
    path: 'settings/markdown-templates',
    loadComponent: () =>
      import('./settings/markdown-template.page').then(
        (module) => module.MarkdownTemplatePage,
      ),
    title: 'Markdown beállítások | Project Maker',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
