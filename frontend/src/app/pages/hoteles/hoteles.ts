import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HotelService } from '../../services/hotel';
import { Hotel } from '../../interfaces/hotel.interface';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../services/admin-auth';

@Component({
  selector: 'app-hoteles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hoteles.html',
  styleUrls: ['./hoteles.scss']
})
export class Hoteles implements OnInit {
  hoteles: Hotel[] = [];
  hotelesFiltrados: Hotel[] = [];
  ciudades: string[] = [];
  ciudadSeleccionada = '';
  calificacionSeleccionada = '';
  cargando = false;
  error = '';
  isSuperAdmin = false;

  constructor(
    private hotelService: HotelService,
    private authService: AdminAuthService
  ) {}

  ngOnInit() {
    this.cargando = true;
    this.isSuperAdmin = this.authService.isLoggedIn();
    this.hotelService.getHoteles().subscribe({
      next: hoteles => {
        this.hoteles = hoteles;
        this.ciudades = [
          ...new Set(hoteles.map(h => h.departamento.trim()))
        ];
        this.hotelesFiltrados = [...hoteles];
        this.cargando = false;
      },
      error: err => {
        this.error = 'No se pudo cargar la lista de hoteles';
        this.cargando = false;
      }
    });
  }

  aplicarFiltros() {
    let filtrados = this.hoteles;

    if (this.ciudadSeleccionada) {
      const ciudad = this.ciudadSeleccionada.trim().toLowerCase();
      filtrados = filtrados.filter(h =>
        h.departamento.trim().toLowerCase() === ciudad
      );
    }

    if (this.calificacionSeleccionada) {
      const calif = parseFloat(this.calificacionSeleccionada);
      filtrados = filtrados.filter(h =>
        Math.round(h.calificacion) === Math.round(calif)
      );
    }

    this.hotelesFiltrados = filtrados;
  }

  onVerDetalles(id_hotel: number) {
    window.location.href = `/hoteles/${id_hotel}`;
  }

  onAgregarHotel() {
    const nombre = prompt('Nombre del hotel:');
    const departamento = prompt('Departamento:');
    const ubicacion = prompt('Ubicación:');
    const calificacion = Number(prompt('Calificación (0-10):'));
    const estado = confirm('¿Hotel activo?');
    if (nombre && departamento && ubicacion && !isNaN(calificacion)) {
      const nuevoHotel: Partial<Hotel> = {
        nombre,
        departamento,
        ubicacion,
        calificacion,
        estado
      };
      this.hotelService.agregarHotel(nuevoHotel).subscribe({
        next: hotel => {
          this.hoteles.push(hotel);
          this.aplicarFiltros();
          alert('Hotel agregado correctamente');
        },
        error: err => alert('Error al agregar hotel')
      });
    }
  }

  onEditarHotel(hotel: Hotel) {
    const nombre = prompt('Nuevo nombre:', hotel.nombre);
    const departamento = prompt('Nuevo departamento:', hotel.departamento);
    const ubicacion = prompt('Nueva ubicación:', hotel.ubicacion);
    const calificacion = Number(prompt('Nueva calificación (0-10):', hotel.calificacion.toString()));
    const estado = confirm('¿Hotel activo?');
    if (nombre && departamento && ubicacion && !isNaN(calificacion)) {
      const hotelActualizado: Hotel = {
        ...hotel,
        nombre,
        departamento,
        ubicacion,
        calificacion,
        estado
      };
      this.hotelService.actualizarHotel(hotelActualizado).subscribe({
        next: h => {
          Object.assign(hotel, h);
          this.aplicarFiltros();
          alert('Hotel actualizado');
        },
        error: err => alert('Error al actualizar hotel')
      });
    }
  }

  onEliminarHotel(hotel: Hotel) {
    if (confirm('¿Eliminar hotel?')) {
      this.hotelService.eliminarHotel(hotel.id_hotel).subscribe({
        next: () => {
          this.hoteles = this.hoteles.filter(h => h.id_hotel !== hotel.id_hotel);
          this.aplicarFiltros();
          alert('Hotel eliminado');
        },
        error: err => alert('Error al eliminar hotel')
      });
    }
  }
}