import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReservasService, Reserva } from '../../services/reservas.service';

@Component({
  selector: 'app-reserva',
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.scss'],
  standalone: true,
  @Component({
    selector: 'app-reserva',
    templateUrl: './reservas.html',
    styleUrls: ['./reservas.scss'],
    standalone: true,
    imports: [FormsModule]
  })
  export class ReservaComponent implements OnInit {
    reservas: Reserva[] = [];

    //Inputs de pago
    tarjeta = '';
    nombre = '';
    expiracion = '';
    cvv = '';

    //Inputs de reserva
    nombreHuesped = '';
    correoHuesped = '';

    constructor(private reservasService: ReservasService) {}

    ngOnInit() {
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