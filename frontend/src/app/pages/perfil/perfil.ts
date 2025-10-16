import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';
import { ReservasService } from '../../services/reservas.service';
import { Reserva } from '../../interfaces/reserva.interface';
import { RouterModule } from '@angular/router'; // 1. Importar RouterModule

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterModule], // 2. Añadir RouterModule a las importaciones
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.scss']
})
export class Perfil implements OnInit {
  usuario: Usuario | null = null;
  cargando = true;

  reservas: Reserva[] = [];
  cargandoReservas = true;
  errorReservas = '';

  constructor(
    private authService: AuthService,
    private reservasService: ReservasService
  ) {}

  ngOnInit(): void {
    this.usuario = this.authService.getUser();
    this.cargando = false;

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
      this.cargandoReservas = false;
    }
  }
}

