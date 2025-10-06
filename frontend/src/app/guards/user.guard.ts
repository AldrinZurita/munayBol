import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const userGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getUser();
  if (user && user.estado) {
    // Opcional: puedes limitar aquí si user.rol === 'usuario' solamente
    return true;
  }
  router.navigate(['/login']);
  return false;
};