import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Routes with parameters - use Client mode
  {
    path: 'reservas/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'lugares-turisticos/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'hoteles/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'habitaciones/:num',
    renderMode: RenderMode.Client
  },
  {
    path: 'paquetes/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'asistente-ia/:sessionId',
    renderMode: RenderMode.Client
  },
  // Routes requiring auth or dynamic data - use Client mode
  {
    path: 'habitaciones',
    renderMode: RenderMode.Client
  },
  {
    // Base AI assistant route (redirects to a session)
    path: 'asistente-ia',
    renderMode: RenderMode.Client
  },
  {
    path: 'registrarse',
    renderMode: RenderMode.Client
  },
  {
    path: 'lugares-turisticos',
    renderMode: RenderMode.Client
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client
  },
  {
    path: 'paquetes',
    renderMode: RenderMode.Client
  },
  {
    path: 'hoteles',
    renderMode: RenderMode.Client
  },
  {
    path: 'perfil',
    renderMode: RenderMode.Client
  },
  {
    path: 'reservas',
    renderMode: RenderMode.Client
  },
  {
    path: 'login',
    renderMode: RenderMode.Client
  },
  // All other routes - use Prerender
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
