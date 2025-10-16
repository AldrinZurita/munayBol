import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService } from '../../services/reservas.service';
import { PagoService, Pago } from '../../services/pago.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HabitacionService } from '../../services/habitacion.service';
import { AuthService } from '../../services/auth.service';
import { Reserva } from '../../interfaces/reserva.interface';

@Component({
  selector: 'app-reserva',
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule]
})
export class ReservaComponent implements OnInit {
  hotel = { nombre: '', ciudad: '', precio: 0 };
  huespedes = 1;
  noches = 1;
  Habitacion = { num: '', precio: 0, hotel: '', capacidad: 1 };
  fecha_reserva: string = '';
  fecha_caducidad: string = '';
  minFechaReserva: string = '';
  minFechaCaducidad: string = '';

// ✅ Subtotal: precio por noche × noches
get subtotal(): number {
  return Math.round(this.hotel.precio * this.noches * 100) / 100;
}

// ✅ IVA: 13% del subtotal, con dos decimales
get iva(): number {
  return Math.round(this.subtotal * 0.13 * 100) / 100;
}

// ✅ Total: subtotal + IVA, con dos decimales
get total(): number {
  return Math.round((this.subtotal + this.iva) * 100) / 100;
}


  showSuccessModal: boolean = false;
  showConflictModal: boolean = false;
  conflictNextAvailable: string = '';
  successCodigo: string = '';
  successTotal: number = 0;
  creating: boolean = false;
  showErrorToast: boolean = false;
  errorMessage: string = '';

  tarjeta = '';
  nombre = '';
  expiracion = '';
  cvv = '';

  constructor(
    private readonly reservasService: ReservasService,
    private readonly pagoService: PagoService,
    private readonly route: ActivatedRoute,
    private readonly habitacionService: HabitacionService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.Habitacion.num = params['num'] || '';
      this.Habitacion.precio = params['precio'] ? Number(params['precio']) : 0;
      this.Habitacion.hotel = params['hotel'] || '';
      this.Habitacion.capacidad = params['capacidad'] ? Number(params['capacidad']) : 1;
      this.fecha_reserva = params['fecha_reserva'] || new Date().toISOString().slice(0,10);
      if (params['fecha_caducidad']) {
        this.fecha_caducidad = params['fecha_caducidad'];
      } else {
        const d = new Date(this.fecha_reserva);
        d.setDate(d.getDate() + 1);
        this.fecha_caducidad = d.toISOString().slice(0,10);
      }
      this.hotel.precio = this.Habitacion.precio;
      this.huespedes = this.Habitacion.capacidad;
      this.minFechaReserva = new Date().toISOString().slice(0,10);
      this.ajustarFechas();
    });
  }

  private ajustarFechas() {
    if (this.fecha_caducidad <= this.fecha_reserva) {
      const d = new Date(this.fecha_reserva);
      d.setDate(d.getDate() + 1);
      this.fecha_caducidad = d.toISOString().slice(0,10);
    }
    const start = new Date(this.fecha_reserva);
    const end = new Date(this.fecha_caducidad);
    const diffMs = end.getTime() - start.getTime();
    const dias = Math.max(1, Math.round(diffMs / (1000*60*60*24)));
    this.noches = dias;
    const minSalida = new Date(this.fecha_reserva);
    minSalida.setDate(minSalida.getDate() + 1);
    this.minFechaCaducidad = minSalida.toISOString().slice(0,10);
  }

  onChangeFechaReserva() {
    this.ajustarFechas();
  }

  onChangeFechaCaducidad() {
    this.ajustarFechas();
  }

  pagoInvalido() {
    return !(new RegExp(/^\d{4} \d{4} \d{4} \d{4}$/).exec(this.tarjeta)) ||
           !this.nombre.trim() ||
           !(new RegExp(/^(0[1-9]|1[0-2])\/(\d{2})$/).exec(this.expiracion)) ||
           !(new RegExp(/^\d{3}$/).exec(this.cvv));
  }

  onTarjetaInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    value = value.substring(0, 16);
    let formatted = '';
    for (let i = 0; i < value.length; i += 4) {
      if (i > 0) formatted += ' ';
      formatted += value.substring(i, i + 4);
    }
    this.tarjeta = formatted;
  }

  onExpiracionInput(event: any) {
    let value = event.target.value.replace(/[^\d]/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    if (value.length >= 3) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    this.expiracion = value;
  }

  confirmarPago() {
    if (this.creating) return;
    if (!this.tarjeta.trim() || !this.nombre.trim() || !this.expiracion.trim() || !this.cvv.trim()) {
      this.lanzarError('Completa todos los campos para simular el pago.');
      return;
    }
    const num = this.Habitacion.num;
    if (!num) {
      alert('No se encontró la habitación.');
      return;
    }
    this.creating = true;
    this.habitacionService.getDisponibilidadHabitacion(num).subscribe({
      next: disp => {
        const conflicto = disp.intervalos_reservados.some((i: any) =>
          this.fecha_reserva <= i.fin && this.fecha_caducidad >= i.inicio
        );
        if (conflicto) {
          this.conflictNextAvailable = disp.next_available_from;
          this.showConflictModal = true;
          this.creating = false;
          return;
        }
        const hoy = new Date().toISOString().slice(0, 10);
        const pago: Pago = {
          tipo_pago: 'tarjeta',
          monto: this.total,
          fecha: hoy,
          fecha_creacion: hoy
        };
        this.pagoService.crearPago(pago).subscribe({
          next: (res) => {
            // Obtener usuario real desde AuthService
            const usuario = this.authService.getUser();
            const reserva: Partial<Reserva> = {
              fecha_reserva: this.fecha_reserva,
              fecha_caducidad: this.fecha_caducidad,
              num_habitacion: this.Habitacion.num,
              codigo_hotel: Number(this.Habitacion.hotel),
              id_usuario: usuario?.id,
              id_pago: res.id_pago
            };
            this.reservasService.crearReserva(reserva).subscribe({
              next: (r) => {
                this.successCodigo = '#MNY' + r.id_reserva.toString(36).toUpperCase();
                this.successTotal = this.total;
                this.showSuccessModal = true;
                this.creating = false;
              },
              error: (err) => {
                this.lanzarError('Error al registrar la reserva: ' + (err.error?.error || err.message));
                this.creating = false;
              }
            });
          },
          error: (err) => {
            this.lanzarError('Error al registrar el pago: ' + (err.error?.error || err.message));
            this.creating = false;
          }
        });
      },
      error: err => {
        this.lanzarError('No se pudo validar disponibilidad: ' + (err.error?.error || err.message));
        this.creating = false;
      }
    });
  }

  cerrarSuccess() {
    this.showSuccessModal = false;
    this.tarjeta = '';
    this.nombre = '';
    this.expiracion = '';
    this.cvv = '';
    this.creating = false;
    setTimeout(()=> this.router.navigate(['']), 0);
  }

  cerrarConflict() { this.showConflictModal = false; }
  usarFechaSugerida() {
    if (this.conflictNextAvailable) {
      this.fecha_reserva = this.conflictNextAvailable;
      const d = new Date(this.fecha_reserva);
      d.setDate(d.getDate() + 1);
      this.fecha_caducidad = d.toISOString().slice(0,10);
      this.showConflictModal = false;
    }
  }
  lanzarError(msg: string) {
    this.errorMessage = msg;
    this.showErrorToast = true;
    setTimeout(()=> this.showErrorToast = false, 4500);
  }
}