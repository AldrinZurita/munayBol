import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService, AdminReservasParams } from '../../services/reservas.service';
import { Reserva } from '../../interfaces/reserva.interface';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-reservas.html',
  styleUrls: ['./admin-reservas.scss']
})
export class AdminReservas implements OnInit, OnDestroy {
  filtroEstado: 'todas' | 'activas' | 'canceladas' = 'todas';
  filtroUsuarioId: string = '';

  cargando = true;
  error = '';
  reservas: Reserva[] = [];

  // Estado de botones
  cancelling = new Set<number>();
  reactivating = new Set<number>();
  removing = new Set<number>();

  // Deco
  animateFun = signal(false);
  private funTimer?: any;

  constructor(
    private reservasService: ReservasService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    if (!user || user.rol !== 'superadmin') {
      this.error = 'Acceso restringido. Se requiere rol superadmin.';
      this.cargando = false;
      return;
    }
    this.cargar();
  }

  ngOnDestroy(): void {
    if (this.funTimer) clearTimeout(this.funTimer);
  }

  triggerFun(ms = 900) {
    this.animateFun.set(true);
    if (this.funTimer) clearTimeout(this.funTimer);
    this.funTimer = setTimeout(() => this.animateFun.set(false), ms);
  }

  buildParams(): AdminReservasParams {
    const params: AdminReservasParams = {};
    if (this.filtroUsuarioId.trim() !== '') {
      const idNum = Number(this.filtroUsuarioId.trim());
      if (!Number.isNaN(idNum)) params.id_usuario = idNum;
    }
    if (this.filtroEstado === 'activas') params.estado = 'true';
    if (this.filtroEstado === 'canceladas') params.estado = 'false';
    return params;
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    const params = this.buildParams();
    this.reservasService.listReservasAdmin(params).subscribe({
      next: (data) => {
        this.reservas = [...data].sort((a, b) => {
          const da = new Date(a.fecha_reserva as any).getTime();
          const db = new Date(b.fecha_reserva as any).getTime();
          return db - da;
        });
        this.cargando = false;
        this.triggerFun(700);
      },
      error: () => {
        this.error = 'No se pudieron cargar las reservas.';
        this.cargando = false;
      }
    });
  }

  limpiar(): void {
    this.filtroEstado = 'todas';
    this.filtroUsuarioId = '';
    this.cargar();
  }

  cancelar(reserva: Reserva): void {
    if (!reserva.estado || this.cancelling.has(reserva.id_reserva)) return;
    this.cancelling.add(reserva.id_reserva);

    // Si estamos viendo activas, animar y remover
    if (this.filtroEstado === 'activas') this.removing.add(reserva.id_reserva);

    this.reservasService.cancelarReserva(reserva.id_reserva).subscribe({
      next: () => {
        if (this.filtroEstado === 'activas') {
          setTimeout(() => {
            this.reservas = this.reservas.filter(r => r.id_reserva !== reserva.id_reserva);
            this.cancelling.delete(reserva.id_reserva);
            this.removing.delete(reserva.id_reserva);
            this.triggerFun(600);
          }, 320);
        } else {
          // En 'todas' o 'canceladas' solo actualiza el estado
          reserva.estado = false;
          this.cancelling.delete(reserva.id_reserva);
          this.removing.delete(reserva.id_reserva);
          this.triggerFun(600);
        }
      },
      error: () => {
        this.cancelling.delete(reserva.id_reserva);
        this.removing.delete(reserva.id_reserva);
        alert('No se pudo cancelar la reserva. Intenta nuevamente.');
      }
    });
  }

  reactivar(reserva: Reserva): void {
    if (reserva.estado || this.reactivating.has(reserva.id_reserva)) return;
    this.reactivating.add(reserva.id_reserva);

    // Si el filtro muestra canceladas, animar salida
    if (this.filtroEstado === 'canceladas') this.removing.add(reserva.id_reserva);

    this.reservasService.reactivarReserva(reserva.id_reserva).subscribe({
      next: () => {
        if (this.filtroEstado === 'canceladas') {
          setTimeout(() => {
            this.reservas = this.reservas.filter(r => r.id_reserva !== reserva.id_reserva);
            this.reactivating.delete(reserva.id_reserva);
            this.removing.delete(reserva.id_reserva);
            this.triggerFun(600);
          }, 320);
        } else {
          reserva.estado = true;
          this.reactivating.delete(reserva.id_reserva);
          this.removing.delete(reserva.id_reserva);
          this.triggerFun(600);
        }
      },
      error: (err) => {
        this.reactivating.delete(reserva.id_reserva);
        this.removing.delete(reserva.id_reserva);
        const msg = err?.error?.error || 'No se pudo reactivar la reserva.';
        alert(msg);
      }
    });
  }

  isRemoving(id: number): boolean {
    return this.removing.has(id);
  }
}
