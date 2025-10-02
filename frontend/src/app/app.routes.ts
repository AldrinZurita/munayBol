import { Routes } from '@angular/router';
import { Hoteles } from './pages/hoteles/hoteles';
import { LugaresTuristicos } from './pages/lugares-turisticos/lugares-turisticos';
import { LugaresTuristicosDetalle } from './pages/lugares-turisticos-detalle/lugares-turisticos-detalle';
import { Inicio } from './pages/inicio/inicio';
import { Habitaciones } from './pages/habitaciones/habitaciones';
import { AdminLogin } from './pages/admin-login/admin-login';
import { ReservaComponent } from './pages/reservas/reservas';
import { AsistenteIa } from './pages/asistente-ia/asistente-ia';
import { HabitacionDetalle } from './pages/habitacion-detalle/habitacion-detalle';
import { Paquetes } from './pages/paquetes/paquetes';
import { PaqueteDetalle } from './pages/paquete-detalle/paquete-detalle';

export const routes: Routes = [
  { path: 'reservas', component: ReservaComponent },
  { path: 'habitaciones', component: Habitaciones },
  { path: 'lugares-turisticos', component: LugaresTuristicos },
  { path: 'lugares-turisticos/:id', component: LugaresTuristicosDetalle},
  { path: 'habitaciones/:num', component: HabitacionDetalle },
  { path: 'hoteles', component: Hoteles },
  { path: 'paquetes', component: Paquetes },
  { path: 'paquetes/:id', component: PaqueteDetalle },
  { path: 'asistente-ia', component: AsistenteIa },
  { path: '', component: Inicio },
  { path: 'login', component: AdminLogin},    
];

