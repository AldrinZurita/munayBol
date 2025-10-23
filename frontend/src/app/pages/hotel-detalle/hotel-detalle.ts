import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Hotel } from '../../interfaces/hotel.interface';
import { HotelService } from '../../services/hotel.service';
import { HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { Loading } from "../../loading/loading";

@Component({
  selector: 'app-hotel-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, Loading],
  templateUrl: './hotel-detalle.html',
  styleUrls: ['./hotel-detalle.scss'],
})
export class HotelDetalleComponent implements OnInit {
  hotel: Hotel | null = null;
  habitaciones: Habitacion[] = [];
  cargando = false;
  cargandoHabitaciones = false;
  error = '';
  errorHabitaciones = ''; // Para separar errores

  constructor(
    private route: ActivatedRoute,
    private hotelService: HotelService,
    private habitacionService: HabitacionService,
  ) { }

  ngOnInit(): void {
    this.cargando = true;
    const idStr = this.route.snapshot.paramMap.get('id');
    const id = Number(idStr);
    console.log('[HotelDetalle] ID recibido:', idStr, '->', id);

    if (!id || isNaN(id)) {
      this.error = 'ID de hotel no válido.';
      this.cargando = false;
      return;
    }
    this.hotelService.getHotelById(id).subscribe({
      next: (hotel) => {
        console.log('[HotelDetalle] Hotel recibido:', hotel);
        this.hotel = hotel;
        this.cargando = false;
        this.getHabitaciones();
      },
      error: (e) => {
        console.error('[HotelDetalle] Error al cargar hotel:', e);
        this.error = 'No se pudo cargar el hotel.';
        this.cargando = false;
      }
    });
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
