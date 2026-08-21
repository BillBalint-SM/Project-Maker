import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthApiService } from './auth-api.service';

export const requireInternalUser: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthApiService);
  const router = inject(Router);
  const login = () =>
    router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  const currentUser = auth.currentUser();

  if (currentUser !== undefined) {
    return currentUser ? true : login();
  }
  return auth.loadSession().pipe(
    map((user) => (user ? true : login())),
    catchError(() => of(login())),
  );
};
