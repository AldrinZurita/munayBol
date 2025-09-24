import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HotelService } from '../../services/hotel';
import { HabitacionService } from '../../services/habitacion';
import { Hotel } from '../../interfaces/hotel.interface';
import { Habitacion } from '../../interfaces/habitacion.interface';

interface Review {
  autor: string;
  texto: string;
  calificacion: number;
  fecha: string;
}

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
  reviews: Review[] = [];

  constructor(
    private route: ActivatedRoute,
    private hotelService: HotelService,
    private habitacionService: HabitacionService
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.hotelService.getHotelById(id).subscribe({
        next: hotel => this.hotel = hotel
      });

      this.habitacionService.getHabitacionesPorHotel(id).subscribe({
        next: habs => {
          this.habitaciones = habs;
          this.generarReviewsFake();
        }
      });
    } else {
      this.generarReviewsFake();
    }
  }

  reservar() {
    alert('Funcionalidad de reserva en construccion 🚀');
  }

  getPrecioHabitacion(): number {
    return this.habitaciones.length > 0 ? this.habitaciones[0].precio : 0;
  }

  getCapacidadHabitacion(): number {
    return this.habitaciones.length > 0 ? this.habitaciones[0].cant_huespedes : 2;
  }

  private generarReviewsFake() {
    this.reviews = [
      { autor: 'Ana', texto: 'Muy acogedor y limpio. Volveria sin duda.', calificacion: 4.5, fecha: '2025-09-10' },
      { autor: 'Luis', texto: 'Excelente ubicacion y atencion. Desayuno completo.', calificacion: 4.2, fecha: '2025-09-12' },
      { autor: 'Maria', texto: 'Hotel con encanto. Ideal para descansar y recorrer.', calificacion: 4.8, fecha: '2025-09-15' },
    ];
  }
}
