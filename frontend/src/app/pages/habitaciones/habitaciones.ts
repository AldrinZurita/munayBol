import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitacionService } from '../../services/habitacion';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-habitaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './habitaciones.html',
  styleUrls: ['./habitaciones.scss']
})

export class Habitaciones implements OnInit {
  habitaciones: Habitacion[] = [];
  habitacionesFiltradas: Habitacion[] = [];
  disponibleSeleccionado = '';
  hotelSeleccionado = '';
  hoteles: number[] = [];
  cargando = false;
  error = '';

  constructor(private habitacionService: HabitacionService) {}

  ngOnInit() {
    this.cargando = true;
    this.habitacionService.getHabitaciones().subscribe({
      next: habitaciones => {
        this.habitaciones = habitaciones;
        this.hoteles = [
          ...new Set(habitaciones.map(h => h.codigo_hotel))
        ];
        this.habitacionesFiltradas = [...habitaciones];
        this.cargando = false;
      },
      error: err => {
        this.error = 'No se pudo cargar la lista de habitaciones';
        this.cargando = false;
      }
    });
  }

  aplicarFiltros() {
    let filtrados = this.habitaciones;

    // Filtrar por disponibilidad
    if (this.disponibleSeleccionado) {
      const disponible = this.disponibleSeleccionado === 'true';
      filtrados = filtrados.filter(h => h.disponible === disponible);
    }

    // Filtrar por hotel
    if (this.hotelSeleccionado) {
      const hotelId = Number(this.hotelSeleccionado);
      filtrados = filtrados.filter(h => h.codigo_hotel === hotelId);
    }

    this.habitacionesFiltradas = filtrados;
  }
}
