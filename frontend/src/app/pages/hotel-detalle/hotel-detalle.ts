import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';

interface Review {
  autor: string;
  texto: string;
  calificacion: number;
  fecha: string;
}

@Component({
  selector: 'app-habitacion-detalle',
  imports: [CommonModule],
  templateUrl: './hotel-detalle.html',
  styleUrls: ['./hotel-detalle.scss'],
  standalone: true,
})
export class HabitacionDetalle implements OnInit {
  habitacion: Habitacion | null = null;
  reviews: Review[] = [];

  constructor(
    private route: ActivatedRoute,
    private habitacionService: HabitacionService
  ) {}

  ngOnInit() {
    const num = this.route.snapshot.paramMap.get('num');
    if (num) {
      this.habitacionService.getHabitaciones().subscribe({
        next: habitaciones => {
          this.habitacion = habitaciones.find(h => h.num === num) || null;
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
    return this.habitacion ? this.habitacion.precio : 0;
  }

  getCapacidadHabitacion(): number {
    return this.habitacion ? this.habitacion.cant_huespedes : 2;
  }

  private generarReviewsFake() {
    this.reviews = [
      { autor: 'Ana', texto: 'Muy acogedor y limpio. Volveria sin duda.', calificacion: 4.5, fecha: '2025-09-10' },
      { autor: 'Luis', texto: 'Excelente ubicacion y atencion. Desayuno completo.', calificacion: 4.2, fecha: '2025-09-12' },
      { autor: 'Maria', texto: 'Hotel con encanto. Ideal para descansar y recorrer.', calificacion: 4.8, fecha: '2025-09-15' },
    ];
  }
}
