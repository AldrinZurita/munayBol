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

// Guards
import { adminGuard } from './guards/admin.guard';
import { userGuard } from './guards/user.guard';

export const routes: Routes = [
  { path: '', component: Inicio },

  // Públicas
  { path: 'login', component: LoginComponent },
  { path: 'registrarse', component: Registrarse },
  { path: 'lugares-turisticos', component: LugaresTuristicos },
  { path: 'lugares-turisticos/:id', component: LugaresTuristicosDetalle},

  // Rutas protegidas para usuarios normales
  { path: 'reservas', component: ReservaComponent, canActivate: [userGuard] },
  { path: 'reservas/:id', component: ReservaDetalleComponent, canActivate: [userGuard] },
  { path: 'habitaciones', component: Habitaciones, canActivate: [userGuard] },
  { path: 'habitaciones/:num', component: HabitacionDetalle, canActivate: [userGuard] },
  { path: 'paquetes', component: Paquetes, canActivate: [userGuard] },
  { path: 'paquetes/:id', component: PaqueteDetalle, canActivate: [userGuard] },
  { path: 'paquetes/nuevo-paquete', component: CrearPaquete, canActivate: [userGuard] },
  { path: 'asistente-ia', component: AsistenteIa, canActivate: [userGuard] },

  // Rutas exclusivas admin
  { path: 'admin', component: Hoteles, canActivate: [adminGuard] },
  // puedes agregar más rutas admin aquí

  // fallback
  { path: '**', redirectTo: '' }
];