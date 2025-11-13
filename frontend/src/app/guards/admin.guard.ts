import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { isPlatformBrowser } from '@angular/common';

export const adminGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  if (!isBrowser) {
    return true;
  }

  const user = authService.getUser();
  if (user && user.estado && user.rol === 'superadmin') {
    return true;
  }

  try {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    const cachedUser = userJson ? JSON.parse(userJson) : null;
    if (token && cachedUser && cachedUser.estado && cachedUser.rol === 'superadmin') {
      return true;
    }
  } catch {}

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
