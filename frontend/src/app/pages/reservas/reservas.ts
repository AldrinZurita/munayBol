import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService } from '../../services/reservas.service';
import { PagoService, Pago } from '../../services/pago.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HabitacionService } from '../../services/habitacion.service';
import { AuthService } from '../../services/auth.service';
import { Reserva } from '../../interfaces/reserva.interface';
import { IconsModule } from '../../icons';
import { LoadingService } from '../../shared/services/loading';
type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'unionpay' | 'unknown';

@Component({
  selector: 'app-reserva',
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule, IconsModule]
})
export class ReservaComponent implements OnInit, OnDestroy {
  hotel = { nombre: '', ciudad: '', precio: 0 };
  huespedes = 1;
  noches = 1;
  Habitacion = { num: '', precio: 0, hotel: '', capacidad: 1 };
  fecha_reserva: string = '';
  fecha_caducidad: string = '';
  minFechaReserva: string = '';
  minFechaCaducidad: string = '';

  get subtotal(): number { return Math.round(this.hotel.precio * this.noches * 100) / 100; }
  get iva(): number { return Math.round(this.subtotal * 0.13 * 100) / 100; }
  get total(): number { return Math.round((this.subtotal + this.iva) * 100) / 100; }

  showSuccessModal = false;
  showConflictModal = false;
  conflictNextAvailable = '';
  successCodigo = '';
  successTotal = 0;
  creating = false;
  showErrorToast = false;
  errorMessage = '';
  successReservaId: number | null = null;
  tarjeta = '';
  nombre = '';
  expiracion = '';
  cvv = '';
  showCvv = false;
  cardBrand: CardBrand = 'unknown';

  touched = { tarjeta: false, nombre: false, expiracion: false, cvv: false };

  constructor(
    private readonly reservasService: ReservasService,
    private readonly pagoService: PagoService,
    private readonly route: ActivatedRoute,
    private readonly habitacionService: HabitacionService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly loadingService: LoadingService
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

  ngOnDestroy(): void {
    this.loadingService.hide();
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
  onChangeFechaReserva() { this.ajustarFechas(); }
  onChangeFechaCaducidad() { this.ajustarFechas(); }
  private onlyDigits(s: string): string { return (s || '').replace(/\D/g, ''); }

  private detectBrand(digits: string): CardBrand {
    if (/^4\d{0,}$/.test(digits)) return 'visa';
    if (/^(5[1-5]\d{0,}|2(2[2-9]\d{0,}|[3-6]\d{0,}|7[01]\d{0,}|720\d{0,}))$/.test(digits)) return 'mastercard';
    if (/^3[47]\d{0,}$/.test(digits)) return 'amex';
    if (/^6(?:011|5)/.test(digits)) return 'discover';
    if (/^3(?:0[0-5]|[68])/.test(digits)) return 'diners';
    if (/^62/.test(digits)) return 'unionpay';
    return 'unknown';
  }

  private formatCardByBrand(digits: string, brand: CardBrand): string {
    if (brand === 'amex') {
      const g1 = digits.slice(0, 4);
      const g2 = digits.slice(4, 10);
      const g3 = digits.slice(10, 15);
      return [g1, g2, g3].filter(Boolean).join(' ');
    }
    const parts: string[] = [];
    for (let i = 0; i < digits.length; i += 4) parts.push(digits.slice(i, i + 4));
    return parts.join(' ');
  }

  private luhnValid(digits: string): boolean {
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits.charAt(i), 10);
      if (shouldDouble) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  isCardNumberValid(): boolean {
    const digits = this.onlyDigits(this.tarjeta);
    if (digits.length < 15) return false;
    return this.luhnValid(digits);
  }
  isNameValid(): boolean { return this.nombre.trim().length >= 3; }
  isExpiryValid(): boolean {
    const m = this.expiracion.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    const mm = Number(m[1]);
    const yy = Number(m[2]);
    if (mm < 1 || mm > 12) return false;
    const fullYear = 2000 + yy;
    const now = new Date();
    const endOfMonth = new Date(fullYear, mm, 0);
    return endOfMonth >= new Date(now.getFullYear(), now.getMonth(), 1);
  }
  isCvvValid(): boolean { return this.cvv.trim().length === this.cvvMaxLength; }

  get cvvMaxLength(): number { return this.cardBrand === 'amex' ? 4 : 3; }
  get cvvPlaceholder(): string { return this.cardBrand === 'amex' ? '1234' : '123'; }

  pagoInvalido(): boolean {
    return !(this.isCardNumberValid() && this.isNameValid() && this.isExpiryValid() && this.isCvvValid());
  }

  onTarjetaInput(event: any) {
    let digits = this.onlyDigits(event.target.value).slice(0, 19);
    this.cardBrand = this.detectBrand(digits);
    digits = this.cardBrand === 'amex' ? digits.slice(0, 15) : digits.slice(0, 16);
    const formatted = this.formatCardByBrand(digits, this.cardBrand);
    this.tarjeta = formatted;
  }

  clearCard(): void { this.tarjeta = ''; this.cardBrand = 'unknown'; }

  onExpiracionInput(event: any) {
    let value = event.target.value.replace(/[^\d]/g, '').slice(0, 4);
    if (value.length >= 3) value = value.slice(0, 2) + '/' + value.slice(2);
    this.expiracion = value;
  }

  confirmarPago() {
    if (this.creating) return;

    this.touched = { tarjeta: true, nombre: true, expiracion: true, cvv: true };
    if (this.pagoInvalido()) {
      this.lanzarError('Revisa los datos del pago.');
      return;
    }

    const num = this.Habitacion.num;
    if (!num) {
      alert('No se encontró la habitación.');
      return;
    }

    this.creating = true;
    this.loadingService.show('Procesando tu reserva...');
    this.habitacionService.getDisponibilidadHabitacion(num).subscribe({
      next: disp => {
        const conflicto = disp.intervalos_reservados?.some((i: any) =>
          this.fecha_reserva <= i.fin && this.fecha_caducidad >= i.inicio
        );
        if (conflicto) {
          this.conflictNextAvailable = disp.next_available_from;
          this.showConflictModal = true;
          this.creating = false;
          this.loadingService.hide();
          return;
        }

        const hoy = new Date().toISOString().slice(0, 10);
        const pago: Pago = { tipo_pago: 'tarjeta', monto: this.total, fecha: hoy, fecha_creacion: hoy };

        this.pagoService.crearPago(pago).subscribe({
          next: (res) => {
            const usuario = this.authService.getUser();
            const reserva: Partial<Reserva> = {
              fecha_reserva: this.fecha_reserva,
              fecha_caducidad: this.fecha_caducidad,
              num_habitacion: this.Habitacion.num,
              codigo_hotel: Number(this.Habitacion.hotel),
              id_usuario: usuario?.id,
              id_pago: res.id_pago,
              id_paquete: this.route.snapshot.queryParams['id_paquete'] || null
            };

            this.reservasService.crearReserva(reserva).subscribe({
              next: (r) => {
                this.successReservaId = r.id_reserva;
                this.successCodigo = '#MNY' + r.id_reserva.toString(36).toUpperCase();
                this.successTotal = this.total;
                this.showSuccessModal = true;
                this.creating = false;
                this.loadingService.hide();
              },
              error: (err) => {
                this.lanzarError('Error al registrar la reserva: ' + (err.error?.error || err.message));
                this.creating = false;
                this.loadingService.hide();
              }
            });
          },
          error: (err) => {
            this.lanzarError('Error al registrar el pago: ' + (err.error?.error || err.message));
            this.creating = false;
            this.loadingService.hide();
          }
        });
      },
      error: err => {
        this.lanzarError('No se pudo validar disponibilidad: ' + (err.error?.error || err.message));
        this.creating = false;
        this.loadingService.hide();
      }
    });
  }

  cerrarSuccess() {
    this.showSuccessModal = false;
    const newId = this.successReservaId;
    this.tarjeta = '';
    this.nombre = '';
    this.expiracion = '';
    this.cvv = '';
    this.cardBrand = 'unknown';
    this.creating = false;
    this.successReservaId = null;

    if (newId) {
      this.router.navigate(['/reservas', newId]);
    } else {
      this.router.navigate(['']);
    }
  }

  cerrarConflict() { this.showConflictModal = false; }
  usarFechaSugerida() {
    if (this.conflictNextAvailable) {
      this.fecha_reserva = this.conflictNextAvailable;
      const d = new Date(this.fecha_reserva);
      d.setDate(d.getDate() + 1);
      this.fecha_caducidad = d.toISOString().slice(0,10);
      this.showConflictModal = false;
      this.ajustarFechas();
    }
  }

  lanzarError(msg: string) {
    this.errorMessage = msg;
    this.showErrorToast = true;
    setTimeout(() => this.showErrorToast = false, 4500);
  }
}
