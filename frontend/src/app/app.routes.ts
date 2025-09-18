import { Routes } from '@angular/router';
import { Hoteles } from './pages/hoteles/hoteles';
import { HotelDetalle } from './pages/hotel-detalle/hotel-detalle';
import { Inicio } from './pages/inicio/inicio';
import { Habitaciones } from './pages/habitaciones/habitaciones';
import { AdminLogin } from './pages/admin-login/admin-login';
import { ReservaComponent } from './pages/reservas/reservas';

export const routes: Routes = [
  { path: 'reservas', component: ReservaComponent},
  { path: 'habitaciones', component: Habitaciones},
  { path: 'hoteles/:id', component: HotelDetalle},
  { path: 'hoteles', component: Hoteles},
  { path: '', component: Inicio },
  { path: 'admin-login', component: AdminLogin},
];
