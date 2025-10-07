import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HotelService } from '../../services/hotel.service';
import { AuthService } from '../../services/auth.service';
import { Hotel } from '../../interfaces/hotel.interface';
import { ActivatedRoute } from '@angular/router';

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

  constructor(
    private hotelService: HotelService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.cargando = true;
    this.hotelService.getHoteles().subscribe({
      next: (hoteles) => {
        this.hoteles = hoteles;
        const allCities = this.hoteles
          .map(h => String(h.departamento ?? '').trim())
          .filter(s => s.length > 0);
        this.ciudades = Array.from(new Set(allCities))
          .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        this.hotelesFiltrados = [...this.hoteles];
        this.cargando = false;
        // aplicar filtro con dpto seleccionado desde inicio
        this.route.queryParams.subscribe(params => {
        this.ciudadSeleccionada = params['departamento'] ?? null;
        this.aplicarFiltros();
      });

      },
      error: () => {
        this.error = 'No se pudo cargar la lista de hoteles';
        this.cargando = false;
      }
    });
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperadmin();
  }

  aplicarFiltros() {
    let filtrados = this.hoteles;
    if (this.ciudadSeleccionada) {
      const ciudad = this.ciudadSeleccionada.trim().toLowerCase();
      filtrados = filtrados.filter(h =>
        String(h.departamento ?? '').trim().toLowerCase() === ciudad
      );
    }
    if (this.calificacionSeleccionada) {
      const calif = Number(this.calificacionSeleccionada);
      if (!Number.isNaN(calif)) {
        filtrados = filtrados.filter(h =>
          Math.round(h.calificacion) === Math.round(calif)
        );
      }
    }
    this.hotelesFiltrados = filtrados;
  }

  onVerDetalles(id_hotel: number) {
    window.location.href = `/hoteles/${id_hotel}`;
  }

  onAgregarHotel() {
    if (!this.isSuperAdmin) return;
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
        next: (hotel) => {
          this.hoteles.push(hotel as Hotel);
          this.aplicarFiltros();
          alert('Hotel agregado correctamente');
        },
        error: () => alert('Error al agregar hotel')
      });
    }
  }

  onEditarHotel(hotel: Hotel) {
    if (!this.isSuperAdmin) return;
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
        next: (h) => {
          Object.assign(hotel, h);
          this.aplicarFiltros();
          alert('Hotel actualizado');
        },
        error: () => alert('Error al actualizar hotel')
      });
    }
  }

  onEliminarHotel(hotel: Hotel) {
    if (!this.isSuperAdmin) return;
    if (confirm('¿Eliminar hotel?')) {
      this.hotelService.eliminarHotel(hotel.id_hotel).subscribe({
        next: () => {
          this.hoteles = this.hoteles.filter(h => h.id_hotel !== hotel.id_hotel);
          this.aplicarFiltros();
          alert('Hotel eliminado');
        },
        error: () => alert('Error al eliminar hotel')
      });
    }
  }

  toStarScore10to5(score10: number): number {
    const s = Math.max(0, Math.min(10, Number(score10) || 0));
    return Math.round((s / 2) * 2) / 2;
  }

  getStarIcons(score10: number): ('full'|'half'|'empty')[] {
    const score5 = this.toStarScore10to5(score10);
    const full = Math.floor(score5);
    const half = score5 - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return [
      ...Array(full).fill('full'),
      ...Array(half).fill('half'),
      ...Array(empty).fill('empty'),
    ];
  }

  formatFiveScale(score10: number): string {
    return `${this.toStarScore10to5(score10).toFixed(1)}/5`;
  }
}