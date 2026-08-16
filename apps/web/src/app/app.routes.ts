import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./projects/project-list.page').then(
        (module) => module.ProjectListPage,
      ),
    title: 'Projects | Project Maker',
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
    path: 'projects/:projectId/interview',
    loadComponent: () =>
      import('./interviews/interview.page').then(
        (module) => module.InterviewPage,
      ),
    title: 'Project interview | Project Maker',
  },
  {
    path: 'projects/:projectId/status',
    loadComponent: () =>
      import('./projects/project-status.page').then(
        (module) => module.ProjectStatusPage,
      ),
    title: 'Projektállapot | Project Maker',
  },
  {
    path: 'projects/:projectId/readiness',
    loadComponent: () =>
      import('./projects/readiness.page').then((module) => module.ReadinessPage),
    title: 'Felkészültség | Project Maker',
  },
  {
    path: 'projects/:projectId/decision-review',
    loadComponent: () =>
      import('./projects/decision-review.page').then(
        (module) => module.DecisionReviewPage,
      ),
    title: 'Döntési értékelés | Project Maker',
  },
  {
    path: 'projects/:projectId/markdown',
    loadComponent: () =>
      import('./markdown/markdown.page').then(
        (module) => module.MarkdownPage,
      ),
    title: 'Markdown execution plan | Project Maker',
  },
  {
    path: 'projects/:projectId',
    loadComponent: () =>
      import('./projects/project-cockpit.page').then(
        (module) => module.ProjectCockpitPage,
      ),
    title: 'Project cockpit | Project Maker',
  },
  {
    path: 'settings/questions',
    loadComponent: () =>
      import('./settings/question-bank.page').then(
        (module) => module.QuestionBankPage,
      ),
    title: 'Question bank settings | Project Maker',
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
