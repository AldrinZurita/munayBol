import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReservasService } from '../../services/reservas.service';
import { HotelService } from '../../services/hotel.service';
import { HabitacionService } from '../../services/habitacion.service';
import { PagoService, Pago } from '../../services/pago.service';
import { RouterModule } from '@angular/router'; 

interface ReservaDetalle {
  id_reserva: number;
  fecha_reserva: string;
  fecha_caducidad: string;
  num_habitacion: string;
  codigo_hotel: number;
  ubicacion_hotel: string;
  fecha_creacion: string;
  ci_usuario: number;
  id_pago: number;
  hotel_nombre?: string;
  habitacion_caracteristicas?: string;
  habitacion_precio?: number;
  habitacion_huespedes?: number;
  pago_info?: Pago;
}

@Component({
  selector: 'app-reserva-detalle',
  templateUrl: './reserva-detalle.html',
  styleUrls: ['./reserva-detalle.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})


// ...importaciones y definición del componente sin cambios...

export class ReservaDetalleComponent implements OnInit {
  reserva: ReservaDetalle | null = null;
  loading: boolean = true;
  error: string = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly reservasService: ReservasService,
    private readonly hotelService: HotelService,
    private readonly habitacionService: HabitacionService,
    private readonly pagoService: PagoService,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.cargarDetalleReserva(Number(id));
      }
    }
  }

  cargarDetalleReserva(id: number) {
    this.loading = true;
    this.reservasService.getReservaById(id).subscribe({
      next: (reserva: any) => {
        this.reserva = reserva;

        if (reserva.codigo_hotel) {
          this.hotelService.getHotelById(reserva.codigo_hotel).subscribe({
            next: (hotel: any) => {
              if (this.reserva) {
                this.reserva.hotel_nombre = hotel.nombre;
                this.reserva.ubicacion_hotel = hotel.ubicacion;
              }
            }
          });
        }

        if (reserva.num_habitacion) {
          this.habitacionService.getHabitacionByNum(reserva.num_habitacion).subscribe({
            next: (habitacion: any) => {
              if (this.reserva) {
                this.reserva.habitacion_caracteristicas = habitacion.caracteristicas;
                this.reserva.habitacion_precio = habitacion.precio;
                this.reserva.habitacion_huespedes = habitacion.cant_huespedes;
              }
            }
          });
        }

        if (reserva.id_pago) {
          this.pagoService.getPagoById(reserva.id_pago).subscribe({
            next: (pago: any) => {
              if (this.reserva) {
                this.reserva.pago_info = pago;
              }
            }
          });
        }

        this.loading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los detalles de la reserva';
        this.loading = false;
        console.error(err);
      }
    });
  }

  calcularNoches(): number {
    if (!this.reserva) return 0;
    const fechaInicio = new Date(this.reserva.fecha_reserva);
    const fechaFin = new Date(this.reserva.fecha_caducidad);
    const diffTime = Math.abs(fechaFin.getTime() - fechaInicio.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  calcularSubtotal(): number {
    if (!this.reserva?.habitacion_precio) return 0;
    return Math.round(this.reserva.habitacion_precio * this.calcularNoches() * 100) / 100;
  }

  calcularIVA(): number {
    const subtotal = this.calcularSubtotal();
    return Math.round(subtotal * 0.13 * 100) / 100;
  }

  calcularTotal(): number {
    return Math.round((this.calcularSubtotal() + this.calcularIVA()) * 100) / 100;
  }

  formatearFecha(fecha: string): string {
    const opciones: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const fechaObj = new Date(fecha);
    return fechaObj.toLocaleDateString('es-BO', opciones);
  }

  formatearFechaCorta(fecha: string): string {
    const fechaObj = new Date(fecha);
    return fechaObj.toLocaleDateString('es-BO');
  }

  obtenerEstadoReserva(): string {
    if (!this.reserva?.pago_info) return 'Pendiente';
    return this.reserva.pago_info.estado || 'Pendiente';
  }

  volverAMisReservas() {
    this.router.navigate(['/mis-reservas']);
  }

  modificarReserva() {
    console.log('Modificar reserva', this.reserva?.id_reserva);
  }

  cancelarReserva() {
    if (confirm('¿Está seguro que desea cancelar esta reserva?')) {
      console.log('Cancelar reserva', this.reserva?.id_reserva);
    }
  }

  ocultarNumeroTarjeta(numeroTarjeta: string): string {
    if (!numeroTarjeta || numeroTarjeta.length < 4) return '****';
    return '****' + numeroTarjeta.slice(-4);
  }
}
