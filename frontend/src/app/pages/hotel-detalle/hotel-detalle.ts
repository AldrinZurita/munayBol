import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HotelService } from '../../services/hotel';
import { Hotel } from '../../interfaces/hotel.interface';
import { ActivatedRoute } from '@angular/router';
import { HabitacionService } from '../../services/habitacion';
import { Habitacion } from '../../interfaces/habitacion.interface';

@Component({
  selector: 'app-hotel-detalle',
  imports: [CommonModule],
  templateUrl: './hotel-detalle.html',
  styleUrls: ['./hotel-detalle.scss'],
  standalone: true,
})
export class HotelDetalle implements OnInit {
  hotel: Hotel | null = null;
  habitaciones: Habitacion[] = [];
  cargandoHotel = false;
  cargandoHabitaciones = false;
  errorHotel = '';
  errorHabitaciones = '';

  constructor(
    private route: ActivatedRoute,
    private hotelService: HotelService,
    private habitacionService: HabitacionService
  ){}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.cargandoHotel = true;
      this.cargandoHabitaciones = true;
      this.hotelService.getHotelById(id).subscribe({
        next: hotel => {
          this.hotel = hotel;
          this.cargandoHotel = false;
        },
        error: err => {
          this.errorHotel = 'No se pudo cargar el hotel';
          this.cargandoHotel = false;
        }
      });
      this.habitacionService.getHabitacionesPorHotel(id).subscribe({
        next: habitaciones => {
          this.habitaciones = habitaciones;
          this.cargandoHabitaciones = false;
        },
        error: err => {
          this.errorHabitaciones = 'No se pudo cargar las habitaciones';
          this.cargandoHabitaciones = false;
        }
      });
    } else {
      this.errorHotel = 'ID de hotel no válido';
      this.errorHabitaciones = 'ID de hotel no válido';
    }
  }
}
