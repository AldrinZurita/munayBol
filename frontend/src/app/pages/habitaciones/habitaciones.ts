import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-habitaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  isSuperAdmin = false;

  constructor(
    private habitacionService: HabitacionService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.cargando = true;
    this.isSuperAdmin = this.authService.isLoggedIn();
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

    if (this.disponibleSeleccionado) {
      const disponible = this.disponibleSeleccionado === 'true';
      filtrados = filtrados.filter(h => h.disponible === disponible);
    }

    if (this.hotelSeleccionado) {
      const hotelId = Number(this.hotelSeleccionado);
      filtrados = filtrados.filter(h => h.codigo_hotel === hotelId);
    }

    this.habitacionesFiltradas = filtrados;
  }

  onAgregarHabitacion() {
    const num = prompt('Número de habitación:')?.trim();
    const codigo_hotel = Number(prompt('Código hotel:'));
    const caracteristicas = prompt('Características:');
    const precio = Number(prompt('Precio:'));
    const cant_huespedes = Number(prompt('Cantidad máxima de huéspedes:'));
    const disponible = confirm('¿Disponible?');
    if (num && !isNaN(codigo_hotel) && caracteristicas && !isNaN(precio) && !isNaN(cant_huespedes)) {
      const nuevaHabitacion: Partial<Habitacion> = {
        num,
        codigo_hotel,
        caracteristicas,
        precio,
        cant_huespedes,
        disponible
      };
      this.habitacionService.agregarHabitacion(nuevaHabitacion).subscribe({
        next: habitacion => {
          this.habitaciones.push(habitacion);
          this.aplicarFiltros();
          alert('Habitación agregada correctamente');
        },
        error: err => alert('Error al agregar habitación')
      });
    }
  }

  onEditarHabitacion(habitacion: Habitacion) {
    const num = prompt('Nuevo número:', habitacion.num)?.trim();
    const codigo_hotel = Number(prompt('Nuevo código hotel:', habitacion.codigo_hotel.toString()));
    const caracteristicas = prompt('Nuevas características:', habitacion.caracteristicas);
    const precio = Number(prompt('Nuevo precio:', habitacion.precio.toString()));
    const cant_huespedes = Number(prompt('Nueva cantidad de huéspedes:', habitacion.cant_huespedes.toString()));
    const disponible = confirm('¿Disponible?');
    if (num && !isNaN(codigo_hotel) && caracteristicas && !isNaN(precio) && !isNaN(cant_huespedes)) {
      const habitacionActualizada: Habitacion = {
        ...habitacion,
        num,
        codigo_hotel,
        caracteristicas,
        precio,
        cant_huespedes,
        disponible
      };
      this.habitacionService.actualizarHabitacion(habitacionActualizada).subscribe({
        next: h => {
          Object.assign(habitacion, h);
          this.aplicarFiltros();
          alert('Habitación actualizada');
        },
        error: err => alert('Error al actualizar habitación')
      });
    }
  }

  onEliminarHabitacion(habitacion: Habitacion) {
    if (confirm('¿Eliminar habitación?')) {
      this.habitacionService.eliminarHabitacion(Number(habitacion.num)).subscribe({
        next: () => {
          this.habitaciones = this.habitaciones.filter(h => h.num !== habitacion.num);
          this.aplicarFiltros();
          alert('Habitación eliminada');
        },
        error: err => alert('Error al eliminar habitación')
      });
    }
  }
}