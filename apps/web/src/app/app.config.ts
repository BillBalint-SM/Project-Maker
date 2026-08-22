import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import {
  provideRouter,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { ProjectMakerPreset } from './app.theme';

const PRIMEUI_LICENSE =
  'eyJpZCI6ImU4NTEzMzYyLWZmZmMtNDdkZC1iMGVhLWIyMTU0MTY4NmEzNSIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODYwMTkwNzYsImV4cCI6MTgxNzU1NTA3Nn0.5m4EjSjYjkFbzebLQ6Gv0LkY5HirW8bj2ZuuCOt0NDJqa8RxP7pMw3VO10Wb9D0UAUeCqOU-IIa7Y9bOqyUgDQ';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(
      routes,
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withViewTransitions({ skipInitialTransition: true }),
    ),
    providePrimeNG({
      license: PRIMEUI_LICENSE,
      theme: {
        preset: ProjectMakerPreset,
        options: {
          darkModeSelector: '.pm-dark',
        },
      },
    }),
  ],
};
