import { HttpInterceptorFn } from '@angular/common/http';

export const userCiInterceptor: HttpInterceptorFn = (req, next) => {
  // Por ahora, usar CI de usuario hardcodeado = 1
  // En producción, esto debería venir de un servicio de autenticación
  const userCi = '1';
  
  console.log('🔵 Interceptor ejecutado para:', req.url);
  
  // Clonar la petición y agregar el header X-User-CI
  const clonedRequest = req.clone({
    setHeaders: {
      'X-User-CI': userCi
    }
  });

  console.log('🟢 Header agregado:', clonedRequest.headers.get('X-User-CI'));

  return next(clonedRequest);
};
