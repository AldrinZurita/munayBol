import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';
import { ReservasService } from '../../services/reservas.service';
import { Reserva } from '../../interfaces/reserva.interface';
import { RouterModule } from '@angular/router';
import { HotelService } from '../../services/hotel.service';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.scss']
})
export class Perfil implements OnInit {
  usuario: Usuario | null = null;
  cargando = true;

  editando = false;
  guardando = false;
  errorGuardar = '';
  form: Partial<Pick<Usuario, 'nombre' | 'pais' | 'pasaporte' | 'avatar_url'>> = {
    nombre: '',
    pais: '',
    pasaporte: '',
    avatar_url: ''
  };

  reservas: (Reserva & { hotel?: any })[] = [];
  cargandoReservas = true;
  errorReservas = '';

  constructor(
    private authService: AuthService,
    private reservasService: ReservasService,
    private hotelService: HotelService
  ) {}

  ngOnInit(): void {
    this.usuario = this.authService.getUser();
    this.cargando = false;

    if (this.usuario) {
      this.form = {
        nombre: this.usuario.nombre,
        pais: this.usuario.pais,
        pasaporte: this.usuario.pasaporte,
        avatar_url: this.usuario.avatar_url || ''
      };

      this.reservasService.getMisReservas().pipe(
        switchMap(reservas => {
          if (reservas.length === 0) return of([]);
          const hotelIds = [...new Set(reservas.map(r => r.codigo_hotel))];
          const hotelRequests = hotelIds.map(id => this.hotelService.getHotelById(id));
          return forkJoin(hotelRequests).pipe(
            map(hoteles => {
              const hotelMap = new Map(hoteles.map(h => [h.id_hotel, h]));
              return reservas.map(reserva => ({ ...reserva, hotel: hotelMap.get(reserva.codigo_hotel) }));
            })
          );
        })
      ).subscribe({
        next: (reservasConHotel) => {
          this.reservas = reservasConHotel;
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

  activarEdicion(): void {
    if (!this.usuario) return;
    this.editando = true;
    this.errorGuardar = '';
  }

  cancelarEdicion(): void {
    if (!this.usuario) return;
    this.editando = false;
    this.errorGuardar = '';
    this.form = {
      nombre: this.usuario.nombre,
      pais: this.usuario.pais,
      pasaporte: this.usuario.pasaporte,
      avatar_url: this.usuario.avatar_url || ''
    };
  }

  guardarCambios(): void {
    if (!this.usuario) return;
    this.guardando = true;
    this.errorGuardar = '';

    // Construir payload solo con cambios
    const payload: any = {};
    const trim = (v: any) => typeof v === 'string' ? v.trim() : v;

    if (trim(this.form.nombre) !== trim(this.usuario.nombre)) payload.nombre = trim(this.form.nombre);
    if (trim(this.form.pais) !== trim(this.usuario.pais)) payload.pais = trim(this.form.pais);
    if (trim(this.form.pasaporte) !== trim(this.usuario.pasaporte)) payload.pasaporte = trim(this.form.pasaporte);
    if (trim(this.form.avatar_url || '') !== trim(this.usuario.avatar_url || '')) payload.avatar_url = trim(this.form.avatar_url);

    // Si no hay cambios, salir
    if (Object.keys(payload).length === 0) {
      this.editando = false;
      this.guardando = false;
      return;
    }

    this.authService.updateMe(payload).subscribe({
      next: (updated: Usuario) => {
        this.usuario = updated;
        this.guardando = false;
        this.editando = false;
      },
      error: (err) => {
        this.errorGuardar = this.leerError(err) || 'No se pudo guardar. Intenta nuevamente.';
        this.guardando = false;
      }
    });
  }

  private leerError(err: any): string {
    try {
      if (err?.error) {
        if (typeof err.error === 'string') return err.error;
        if (typeof err.error === 'object') {
          // Mostrar el primer mensaje del serializer si existe
          const firstKey = Object.keys(err.error)[0];
          const val = err.error[firstKey];
          if (Array.isArray(val)) return val[0];
          if (typeof val === 'string') return val;
        }
      }
    } catch {}
    return '';
  }
}
