import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-reserva',
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.scss'],
  standalone: true,
  imports: [FormsModule]
})
export class ReservaComponent {
  hotel = {
    nombre: '',
    ciudad: '',
    precio: 0
  };
  huespedes = 1;
  noches = 1;

  //Inputs de pago
  tarjeta = '';
  nombre = '';
  expiracion = '';
  cvv = '';

  //Inputs de reserva
  nombreHuesped = '';
  correoHuesped = '';

  //Calculos de precios
  get subtotal() {
    return this.hotel.precio * this.noches;
  }
  get iva() {
    return Math.round(this.subtotal * 0.13);
  }
  get total() {
    return this.subtotal + this.iva;
  }

  constructor(private route: ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      //Simulacion para recibir datos por query params
      this.hotel.nombre = params['nombre'] || 'Hotel Inti Raymi';
      this.hotel.ciudad = params['ciudad'] || 'La Paz';
      this.hotel.precio = params['precio'] ? Number(params['precio']) : 250;
      this.huespedes = params['huespedes'] ? Number(params['huespedes']) : 2;
      this.noches = params['noches'] ? Number(params['noches']) : 1;
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
    alert('¡Pago realizado con éxito!');
  }

  confirmarReserva() {
    if (!this.nombreHuesped.trim() || !this.correoHuesped.trim()) {
      alert('Por favor, ingresa nombre y correo.');
      return;
    }
    alert('¡Reserva confirmada!');
  }
}