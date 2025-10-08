import { Routes } from '@angular/router';
import { Hoteles } from './pages/hoteles/hoteles';
import { LugaresTuristicos } from './pages/lugares-turisticos/lugares-turisticos';
import { LugaresTuristicosDetalle } from './pages/lugares-turisticos-detalle/lugares-turisticos-detalle';
import { Inicio } from './pages/inicio/inicio';
import { Habitaciones } from './pages/habitaciones/habitaciones';
import { LoginComponent } from './pages/login/login';
import { ReservaComponent } from './pages/reservas/reservas';
import { ReservaDetalleComponent } from './pages/reserva-detalle/reserva-detalle';
import { AsistenteIa } from './pages/asistente-ia/asistente-ia';
import { HabitacionDetalle } from './pages/habitacion-detalle/habitacion-detalle';
import { Paquetes } from './pages/paquetes/paquetes';
import { PaqueteDetalle } from './pages/paquete-detalle/paquete-detalle';
import { CrearPaquete } from './pages/crear-paquete/crear-paquete';
import { Registrarse } from './pages/registrarse/registrarse';
import { HotelDetalleComponent } from './pages/hotel-detalle/hotel-detalle';

// Guards
import { adminGuard } from './guards/admin.guard';
import { userGuard } from './guards/user.guard';

export const routes: Routes = [
  { path: '', component: Inicio },

  // Públicas
  { path: 'login', component: LoginComponent },
  { path: 'registrarse', component: Registrarse },
  { path: 'lugares-turisticos', component: LugaresTuristicos },
  { path: 'lugares-turisticos/:id', component: LugaresTuristicosDetalle },
  { path: 'hoteles', component: Hoteles},
  { path: 'hoteles/:id', component: HotelDetalleComponent},
  { path: 'habitaciones', component: Habitaciones },
  { path: 'habitaciones/:num', component: HabitacionDetalle },
  { path: 'paquetes', component: Paquetes},
  { path: 'paquetes/:id', component: PaqueteDetalle},
  //{ path: 'asistente-ia', component: AsistenteIa},

  // Rutas protegidas para usuarios autenticados (usuario o superadmin)
  { path: 'reservas', component: ReservaComponent, canActivate: [userGuard] },
  { path: 'reservas/:id', component: ReservaDetalleComponent, canActivate: [userGuard] },
  { path: 'paquetes/nuevo-paquete', component: CrearPaquete, canActivate: [adminGuard] },
  { path: 'asistente-ia', component: AsistenteIa, canActivate: [userGuard] },

  // Rutas exclusivas admin (superadmin)
  { path: 'admin', component: Hoteles, canActivate: [adminGuard] },
  // { path: 'admin/habitaciones', component: HabitacionesAdmin, canActivate: [adminGuard] },
  // { path: 'admin/paquetes', component: PaquetesAdmin, canActivate: [adminGuard] },

  { path: '**', redirectTo: '' }
];