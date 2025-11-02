import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { JwtInterceptor } from './interceptors/jwt.interceptor';

import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    // HttpClient en cliente con soporte para interceptores DI
    provideHttpClient(withInterceptorsFromDi()),

    // Interceptor JWT para adjuntar Authorization: Bearer <token>
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },

    // Opcionales recomendados
    provideClientHydration(),
    provideAnimations(),
  ],
};
