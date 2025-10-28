import { Routes } from '@angular/router';

// Páginas públicas
import { Inicio } from './pages/inicio/inicio';
import { LoginComponent } from './pages/login/login';
import { Registrarse } from './pages/registrarse/registrarse';
import { LugaresTuristicos } from './pages/lugares-turisticos/lugares-turisticos';
import { LugaresTuristicosDetalle } from './pages/lugares-turisticos-detalle/lugares-turisticos-detalle';
import { Hoteles } from './pages/hoteles/hoteles';
import { HotelDetalleComponent } from './pages/hotel-detalle/hotel-detalle';
import { Habitaciones } from './pages/habitaciones/habitaciones';
import { HabitacionDetalle } from './pages/habitacion-detalle/habitacion-detalle';
import { Paquetes } from './pages/paquetes/paquetes';
import { PaqueteDetalle } from './pages/paquete-detalle/paquete-detalle';

// Páginas protegidas
import { ReservaComponent } from './pages/reservas/reservas';
import { ReservaDetalleComponent } from './pages/reserva-detalle/reserva-detalle';
import { AsistenteIa } from './pages/asistente-ia/asistente-ia';
import { Perfil } from './pages/perfil/perfil';

// Admin pages
import { CrearPaquete } from './pages/crear-paquete/crear-paquete';
import { AdminReservas } from './pages/admin-reservas/admin-reservas';

// Guards
import { adminGuard } from './guards/admin.guard';
import { userGuard } from './guards/user.guard';

export const routes: Routes = [
  // Públicas
  { path: '', component: Inicio, title: 'Inicio' },
  { path: 'login', component: LoginComponent, title: 'Iniciar sesión' },
  { path: 'registrarse', component: Registrarse, title: 'Crear cuenta' },
  { path: 'lugares-turisticos', component: LugaresTuristicos, title: 'Lugares turísticos' },
  { path: 'lugares-turisticos/:id', component: LugaresTuristicosDetalle, title: 'Detalle de lugar' },
  { path: 'hoteles', component: Hoteles, title: 'Hoteles' },
  { path: 'hoteles/:id', component: HotelDetalleComponent, title: 'Detalle de hotel' },
  { path: 'habitaciones', component: Habitaciones, title: 'Habitaciones' },
  { path: 'habitaciones/:num', component: HabitacionDetalle, title: 'Detalle de habitación' },
  { path: 'paquetes', component: Paquetes, title: 'Paquetes' },
  { path: 'paquetes/:id', component: PaqueteDetalle, title: 'Detalle de paquete' },

  // Rutas protegidas para usuarios autenticados (usuario o superadmin)
  { path: 'reservas', component: ReservaComponent, canActivate: [userGuard], title: 'Mis reservas' },
  { path: 'reservas/:id', component: ReservaDetalleComponent, canActivate: [userGuard], title: 'Detalle de reserva' },

  // Asistente IA con historial
  { path: 'asistente-ia', component: AsistenteIa, canActivate: [userGuard], title: 'Asistente IA' },
  { path: 'asistente-ia/:sessionId', component: AsistenteIa, canActivate: [userGuard], title: 'Asistente IA' },

  { path: 'perfil', component: Perfil, canActivate: [userGuard], title: 'Mi perfil' },

  // Rutas exclusivas admin (superadmin)
  { path: 'paquetes/nuevo-paquete', component: CrearPaquete, canActivate: [adminGuard], title: 'Crear paquete' },

  // Nueva pantalla de administración de reservas (ver activas y canceladas, filtrar por usuario)
  { path: 'admin/reservas', component: AdminReservas, canActivate: [adminGuard], title: 'Administración de reservas' },

  // Puedes mantener este alias si ya lo usabas como dashboard admin
  { path: 'admin', component: Hoteles, canActivate: [adminGuard], title: 'Panel de administración' },

  // Fallback
  { path: '**', redirectTo: '' }
];
