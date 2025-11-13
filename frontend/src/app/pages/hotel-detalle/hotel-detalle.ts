import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Hotel } from '../../interfaces/hotel.interface';
import { HotelService } from '../../services/hotel.service';
import { HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { LoadingService } from '../../shared/services/loading';

@Component({
  selector: 'app-hotel-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hotel-detalle.html',
  styleUrls: ['./hotel-detalle.scss'],
})
export class HotelDetalleComponent implements OnInit, OnDestroy {
  hotel: Hotel | null = null;
  habitaciones: Habitacion[] = [];
  cargandoHabitaciones = false;
  error = '';
  errorHabitaciones = '';

  constructor(
    private route: ActivatedRoute,
    private hotelService: HotelService,
    private habitacionService: HabitacionService,
    private loadingService: LoadingService
  ) { }

  ngOnInit(): void {
    this.loadingService.show('Cargando hotel...');
    const idStr = this.route.snapshot.paramMap.get('id');
    const id = Number(idStr);
    console.log('[HotelDetalle] ID recibido:', idStr, '->', id);

    if (!id || isNaN(id)) {
      this.error = 'ID de hotel no válido.';
      this.loadingService.hide();
      return;
    }
    this.hotelService.getHotelById(id).subscribe({
      next: (hotel) => {
        console.log('[HotelDetalle] Hotel recibido:', hotel);
        this.hotel = hotel;
        this.loadingService.hide();
        this.getHabitaciones();
      },
      error: (e) => {
        console.error('[HotelDetalle] Error al cargar hotel:', e);
        this.error = 'No se pudo cargar el hotel.';
        this.loadingService.hide();
      }
    });
  }

  ngOnDestroy(): void {
    this.loadingService.hide();
  }

  getHabitaciones(): void {
    if (!this.hotel || !this.hotel.id_hotel) {
      this.errorHabitaciones = 'No se ha seleccionado un hotel válido';
      return;
    }

    this.cargandoHabitaciones = true;
    this.errorHabitaciones = '';
    this.habitacionService.getHabitacionesPorHotel(this.hotel.id_hotel).subscribe({
      next: (habitaciones: Habitacion[]) => {
        console.log('[HotelDetalle] Habitaciones recibidas:', habitaciones);
        this.habitaciones = habitaciones;
        this.cargandoHabitaciones = false;
      },
      error: (err) => {
        console.error('[HotelDetalle] Error al obtener habitaciones:', err);
        this.errorHabitaciones = 'No se pudo cargar la lista de habitaciones';
        this.cargandoHabitaciones = false;
      }
    });
  }
}
