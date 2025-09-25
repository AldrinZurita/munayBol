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
  hotel = { nombre: '', ciudad: '', precio: 0 };
  huespedes = 1;
  noches = 1;
  Habitacion = { num: '', precio: 0, hotel: '', capacidad: 1 };

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

  //Inputs de reserva
  nombreHuesped = '';
  correoHuesped = '';

  constructor(
    private reservasService: ReservasService,
    private pagoService: PagoService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.Habitacion.num = params['num'] || '';
      this.Habitacion.precio = params['precio'] ? Number(params['precio']) : 0;
      this.Habitacion.hotel = params['hotel'] || '';
      this.Habitacion.capacidad = params['capacidad'] ? Number(params['capacidad']) : 1;
      this.hotel.precio = this.Habitacion.precio;
      this.huespedes = this.Habitacion.capacidad;
    });
    this.reservasService.getReservas().subscribe(data => {
      this.reservas = data;
    });
  }

  //Validacion simple
  pagoInvalido() {
    return !this.tarjeta.match(/^\d{4} \d{4} \d{4} \d{4}$/) ||
           !this.nombre.trim() ||
           !this.expiracion.match(/^(0[1-9]|1[0-2])\/(\d{2})$/) ||
           !this.cvv.match(/^\d{3}$/);
  }

  confirmarPago() {
    if (this.pagoInvalido()) {
      alert('Por favor, completa todos los campos correctamente.');
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
        alert('Pago registrado en la base de datos. ID: ' + res.id_pago);
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