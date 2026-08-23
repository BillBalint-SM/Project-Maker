import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { AppThemeState } from './app/theme/app-theme.state';

bootstrapApplication(AppComponent, appConfig)
  .then((application) => application.injector.get(AppThemeState))
  .catch((error: unknown) => {
    console.error('Failed to bootstrap Project Maker.', error);
  });
