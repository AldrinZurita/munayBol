import { Routes } from '@angular/router';
import { Hoteles } from './pages/hoteles/hoteles';
import { HotelDetalle } from './pages/hotel-detalle/hotel-detalle';
import { Inicio } from './pages/inicio/inicio';
import { Habitaciones } from './pages/habitaciones/habitaciones';

export const routes: Routes = [
  { path: 'habitaciones', component: Habitaciones},
  { path: 'hoteles/:id', component: HotelDetalle},
  { path: 'hoteles', component: Hoteles},
  { path: '', component: Inicio },
];
