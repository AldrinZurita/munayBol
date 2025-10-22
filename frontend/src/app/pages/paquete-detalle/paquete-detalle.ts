import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PaqueteService } from '../../services/paquete.service';
import { Paquete } from '../../interfaces/paquete.interface';
import { HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-paquete-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './paquete-detalle.html',
  styleUrls: ['./paquete-detalle.scss']
})
export class PaqueteDetalle implements OnInit {
  paquete: Paquete | null = null;
  itinerario: string[] = [];
  infoImportante: string[] = [];
  error = '';
  cargando = true;

  fechaReserva = '';
  fechaCaducidad = '';
  proxDisponible = '';
  showConflictModal = false;
  habitacionSeleccionada: Habitacion | null = null;
  mensajeFechaLibre = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paqueteService: PaqueteService,
    private habitacionService: HabitacionService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error = 'ID de paquete no válido';
      this.cargando = false;
      return;
    }

    this.paqueteService.getPaqueteById(id).subscribe({
      next: (data) => {
        this.paquete = data;
        this.itinerario = (data as any).itinerario ?? [];
        this.infoImportante = (data as any).info_importante ?? [];
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'No se pudo cargar el paquete';
        this.cargando = false;
        console.error(err);
      }
    });
  }

  onChangeFechaReserva() {
    if (this.fechaReserva) {
      this.fechaCaducidad = this.addDias(this.fechaReserva, 1);
    }
  }

  reservarPaquete() {
    if (!this.paquete?.hotel?.id_hotel) return;

    this.habitacionService.getHabitaciones().subscribe({
      next: habitaciones => {
        const disponibles = habitaciones.filter(h =>
          h.codigo_hotel === this.paquete!.hotel!.id_hotel && h.disponible
        );

        if (disponibles.length === 0) {
          alert('No hay habitaciones disponibles en este hotel.');
          return;
        }

        this.habitacionSeleccionada = disponibles[0];

        this.habitacionService.getDisponibilidadHabitacion(this.habitacionSeleccionada.num).subscribe({
          next: disponibilidad => {
            this.proxDisponible = disponibilidad.next_available_from;
            this.showConflictModal = true;
            this.fechaReserva = this.proxDisponible;
            this.fechaCaducidad = this.addDias(this.proxDisponible, 1);
            this.mensajeFechaLibre = '';
          }
        });
      }
    });
  }
 
  probarFechasPersonalizadas() {
    if (!this.habitacionSeleccionada || !this.fechaReserva || !this.fechaCaducidad) {
      alert('Selecciona ambas fechas para continuar.');
      return;
    }

    this.habitacionService.getDisponibilidadHabitacion(this.habitacionSeleccionada.num).subscribe({
      next: disponibilidad => {
        const haySolapamiento = disponibilidad.intervalos_reservados.some(it =>
          this.fechaReserva <= it.fin && this.fechaCaducidad >= it.inicio
        );

        if (haySolapamiento) {
          this.mensajeFechaLibre = '❌ Las fechas seleccionadas están ocupadas.';
        } else {
          this.mensajeFechaLibre = '🎉 ¡Felicidades! Las fechas seleccionadas están disponibles.';
          setTimeout(() => {
            this.showConflictModal = false;
            this.redirigirAReservas();
          }, 1500);
        }
      }
    });
  }

  redirigirAReservas() {
    this.router.navigate(['/reservas'], {
      queryParams: {
        num: this.habitacionSeleccionada!.num,
        precio: this.paquete!.precio,
        hotel: this.paquete!.hotel!.id_hotel,
        capacidad: this.habitacionSeleccionada!.cant_huespedes,
        fecha_reserva: this.fechaReserva,
        fecha_caducidad: this.fechaCaducidad,
        id_paquete: this.paquete!.id_paquete
      }
    });
  }

  cancelarReserva() {
    this.showConflictModal = false;
    this.router.navigate(['/paquetes']);
  }

  formatearFecha(fecha: string): string {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private addDias(fecha: string, dias: number): string {
    const d = new Date(fecha);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  getPrecioFormateado(): string {
    return this.paquete ? `${this.paquete.precio.toFixed(2)} BOB` : '';
  }

  getDuracion(): string {
    return this.itinerario.length ? `${this.itinerario.length} días` : 'Duración no especificada';
  }

  getGrupo(): string {
    const info = this.infoImportante.find((i: string) =>
      i.toLowerCase().includes('grupo')
    );
    return info || 'Grupo estándar';
  }
}
