import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { JwtInterceptor } from './interceptors/jwt.interceptor';

export const config: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideRouter(routes),

    // HttpClient en SSR con soporte para interceptores DI
    provideHttpClient(withInterceptorsFromDi()),

    // Interceptor JWT también disponible en SSR (no usará localStorage en server)
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
  ],
};
