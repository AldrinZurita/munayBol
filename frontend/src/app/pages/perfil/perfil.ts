import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';
import { ReservasService } from '../../services/reservas.service'; // 1. Import ReservasService
import { Reserva } from '../../interfaces/reserva.interface';     // 2. Import Reserva interface
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterModule], // Add RouterModule for the "Explorar Paquetes" button
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.scss']
})
export class Perfil implements OnInit {
  usuario: Usuario | null = null;
  cargando = true;

  // --- NEW PROPERTIES for reservations ---
  reservas: Reserva[] = [];
  cargandoReservas = true;
  errorReservas = '';

  constructor(
    private authService: AuthService,
    private reservasService: ReservasService // 3. Inject ReservasService
  ) {}

  ngOnInit(): void {
    this.usuario = this.authService.getUser();
    this.cargando = false;

    // --- NEW LOGIC to fetch reservations ---
    if (this.usuario) {
      this.reservasService.getMisReservas().subscribe({
        next: (data) => {
          this.reservas = data;
          this.cargandoReservas = false;
        },
        error: () => {
          this.errorReservas = 'No se pudieron cargar tus reservas.';
          this.cargandoReservas = false;
        }
      });
    } else {
      // If there's no user, we can't fetch reservations.
      this.cargandoReservas = false; 
      this.errorReservas = 'Debes iniciar sesión para ver tus reservas.';
    }
  }
}

