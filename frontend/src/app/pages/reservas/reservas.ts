import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService, Reserva } from '../../services/reservas.service';
import { PagoService, Pago } from '../../services/pago.service';
import { ActivatedRoute } from '@angular/router';

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

  get subtotal() {
    return this.Habitacion.precio * this.noches;
  }
  get iva() {
    return Math.round(this.subtotal * 0.13);
  }
  get total() {
    return this.subtotal + this.iva;
  }
  reservas: Reserva[] = [];

  //Inputs de pago
  tarjeta = '';
  nombre = '';
  expiracion = '';
  cvv = '';

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

  //Inputs de reserva
  nombreHuesped = '';
  correoHuesped = '';

  constructor(
    private readonly reservasService: ReservasService,
    private readonly pagoService: PagoService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.Habitacion.num = params['num'] || '';
      this.Habitacion.precio = params['precio'] ? Number(params['precio']) : 0;
      this.Habitacion.hotel = params['hotel'] || '';
      this.Habitacion.capacidad = params['capacidad'] ? Number(params['capacidad']) : 1;
      this.fecha_reserva = params['fecha_reserva'] || new Date().toISOString().slice(0,10);
      // Si no viene fecha_caducidad, por defecto un día después de la reserva
      if (params['fecha_caducidad']) {
        this.fecha_caducidad = params['fecha_caducidad'];
      } else {
        const d = new Date(this.fecha_reserva);
        d.setDate(d.getDate() + 1);
        this.fecha_caducidad = d.toISOString().slice(0,10);
      }
      this.hotel.precio = this.Habitacion.precio;
      this.huespedes = this.Habitacion.capacidad;
    });
    this.reservasService.getReservas().subscribe(data => {
      this.reservas = data;
    });
  }

  //Validacion simple
   pagoInvalido() {
    return !(new RegExp(/^\d{4} \d{4} \d{4} \d{4}$/).exec(this.tarjeta)) ||
           !this.nombre.trim() ||
           !(new RegExp(/^(0[1-9]|1[0-2])\/(\d{2})$/).exec(this.expiracion)) ||
           !(new RegExp(/^\d{3}$/).exec(this.cvv));
  }

  confirmarPago() {
    // Simulación: solo valida formato básico y crea el pago
    if (!this.tarjeta.trim() || !this.nombre.trim() || !this.expiracion.trim() || !this.cvv.trim()) {
      alert('Completa todos los campos para simular el pago.');
      return;
    }
    // Crear pago real en backend
  const hoy = new Date().toISOString().slice(0, 10);
    const pago: Pago = {
      tipo_pago: 'tarjeta',
      monto: this.total,
      fecha: hoy,
      fecha_creacion: hoy
    };
    this.pagoService.crearPago(pago).subscribe({
      next: (res) => {
        // Registrar reserva real con el id_pago recibido
        const reserva = {
          fecha_reserva: this.fecha_reserva,
          fecha_caducidad: this.fecha_caducidad,
          num_habitacion: this.Habitacion.num,
          codigo_hotel: Number(this.Habitacion.hotel),
          ci_usuario: 1, // Placeholder: integrar ID real de usuario autenticado
          id_pago: res.id_pago
        };
        this.reservasService.crearReserva(reserva).subscribe({
          next: (r) => {
            alert('Reserva registrada. ID: ' + r.id_reserva);
          },
          error: (err) => {
            alert('Error al registrar la reserva: ' + (err.error?.error || err.message));
          }
        });
      },
      error: (err) => {
        alert('Error al registrar el pago: ' + (err.error?.error || err.message));
      }
    });
  }

  confirmarReserva() {
    if (!this.nombreHuesped.trim() || !this.correoHuesped.trim()) {
      alert('Por favor, ingresa nombre y correo.');
      return;
    }
    alert('¡Reserva confirmada!');
  }
}