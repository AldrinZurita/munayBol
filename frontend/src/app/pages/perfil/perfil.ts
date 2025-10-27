import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
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

const CONFIRM_TRANSITION_MS = 300; // Mantener en sync con --confirm-ms en SCSS

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.scss']
})
export class Perfil implements OnInit, OnDestroy {
  usuario: Usuario | null = null;
  cargando = true;

  loaderVisible = false;
  loaderProgress = 0;
  private loaderTimer?: any;

  editando = false;
  guardando = false;
  errorGuardar = '';
  form: Partial<Pick<Usuario, 'nombre' | 'pais' | 'pasaporte' | 'avatar_url'>> = {
    nombre: '', pais: '', pasaporte: '', avatar_url: ''
  };

  reservas: (Reserva & { hotel?: any })[] = [];
  cargandoReservas = true;
  errorReservas = '';

  // Estados de cancelación y animación
  cancelling: Set<number> = new Set<number>();
  removing: Set<number> = new Set<number>();
  confirmId: number | null = null;

  // Modo animación extra
  animateFun = false;
  private funTimer?: any;

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

      this.startLoader();

      this.reservasService.getMisReservas().pipe(
        switchMap(reservas => {
          if (!reservas || reservas.length === 0) return of<((Reserva & { hotel?: any })[])>([]);
          const hotelIds = [...new Set(reservas.map(r => r.codigo_hotel))];
          const hotelRequests = hotelIds.map(id => this.hotelService.getHotelById(id));
          return forkJoin(hotelRequests).pipe(
            map(hoteles => {
              const hotelMap = new Map(hoteles.map(h => [h.id_hotel, h]));
              const enriched = reservas.map(reserva => ({ ...reserva, hotel: hotelMap.get(reserva.codigo_hotel) }));
              return enriched.sort((a, b) => {
                const da = new Date(a.fecha_reserva as any).getTime();
                const db = new Date(b.fecha_reserva as any).getTime();
                return db - da;
              });
            })
          );
        })
      ).subscribe({
        next: (reservasConHotel) => {
          this.reservas = reservasConHotel;
          this.cargandoReservas = false;
          this.finishLoader(true);
        },
        error: () => {
          this.errorReservas = 'No se pudieron cargar tus reservas.';
          this.cargandoReservas = false;
          this.finishLoader(false);
        }
      });
    } else {
      this.cargandoReservas = false;
      this.loaderVisible = false;
    }
  }

  ngOnDestroy(): void {
    if (this.loaderTimer) clearInterval(this.loaderTimer);
    if (this.funTimer) clearTimeout(this.funTimer);
  }

  private startLoader(): void {
    this.loaderVisible = true;
    this.loaderProgress = 0;
    if (this.loaderTimer) clearInterval(this.loaderTimer);
    this.loaderTimer = setInterval(() => {
      const inc = Math.random() * 6 + 2; // 2% - 8%
      const targetCap = 90;
      this.loaderProgress = Math.min(targetCap, this.loaderProgress + inc);
    }, 250);
  }

  private finishLoader(success: boolean): void {
    if (this.loaderTimer) {
      clearInterval(this.loaderTimer);
      this.loaderTimer = undefined;
    }
    const step = () => {
      if (this.loaderProgress < 100) {
        this.loaderProgress = Math.min(100, this.loaderProgress + 5);
        requestAnimationFrame(step);
      } else {
        setTimeout(() => {
          this.loaderVisible = false;
          if (success) this.triggerFun(1600);
        }, 250);
      }
    };
    step();
  }

  triggerFun(durationMs: number = 1200): void {
    this.animateFun = true;
    if (this.funTimer) clearTimeout(this.funTimer);
    this.funTimer = setTimeout(() => (this.animateFun = false), durationMs);
  }

  toggleConfirm(id: number): void {
    this.confirmId = this.confirmId === id ? null : id;
  }

  closeConfirm(): void {
    this.confirmId = null;
  }

  confirmarCancel(reserva: Reserva & { hotel?: any }): void {
    if (!reserva.estado || this.cancelling.has(reserva.id_reserva)) return;

    this.cancelling.add(reserva.id_reserva);
    // Marca para animación de salida (suavizado)
    this.removing.add(reserva.id_reserva);

    this.reservasService.cancelarReserva(reserva.id_reserva).subscribe({
      next: () => {
        // Esperar a que termine la transición CSS para remover del array
        setTimeout(() => {
          this.reservas = this.reservas.filter(r => r.id_reserva !== reserva.id_reserva);
          this.cancelling.delete(reserva.id_reserva);
          this.removing.delete(reserva.id_reserva);
          this.confirmId = null;
          this.triggerFun(800);
        }, CONFIRM_TRANSITION_MS);
      },
      error: (err) => {
        // Revertir la animación
        this.cancelling.delete(reserva.id_reserva);
        this.removing.delete(reserva.id_reserva);
        this.confirmId = null;
        console.error('Error al cancelar:', err);
        alert('No se pudo cancelar la reserva. Intenta nuevamente.');
      }
    });
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
    const payload: any = {};
    const trim = (v: any) => typeof v === 'string' ? v.trim() : v;
    if (trim(this.form.nombre) !== trim(this.usuario.nombre)) payload.nombre = trim(this.form.nombre);
    if (trim(this.form.pais) !== trim(this.usuario.pais)) payload.pais = trim(this.form.pais);
    if (trim(this.form.pasaporte) !== trim(this.usuario.pasaporte)) payload.pasaporte = trim(this.form.pasaporte);
    if (trim(this.form.avatar_url || '') !== trim(this.usuario.avatar_url || '')) payload.avatar_url = trim(this.form.avatar_url);
    if (Object.keys(payload).length === 0) { this.editando = false; this.guardando = false; return; }

    this.authService.updateMe(payload).subscribe({
      next: (updated: Usuario) => {
        this.usuario = updated;
        this.guardando = false;
        this.editando = false;
        this.triggerFun(800);
      },
      error: (err) => {
        this.errorGuardar = this.leerError(err) || 'No se pudo guardar. Intenta nuevamente.';
        this.guardando = false;
      }
    });
  }

  trackByReserva = (_: number, item: Reserva & { hotel?: any }) => item.id_reserva;

  onAvatarError(evt: Event): void {
    const img = evt.target as HTMLImageElement;
    img.style.display = 'none';
  }

  private leerError(err: any): string {
    try {
      if (err?.error) {
        if (typeof err.error === 'string') return err.error;
        if (typeof err.error === 'object') {
          const firstKey = Object.keys(err.error)[0];
          const val = (err.error as any)[firstKey];
          if (Array.isArray(val)) return val[0];
          if (typeof val === 'string') return val;
        }
      }
    } catch {}
    return '';
  }

  // Atajos de teclado: guardar/cancelar en edición y cerrar confirmación con Escape
  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    const key = ev.key.toLowerCase();

    // Si está el confirm abierto, cerrar con Escape
    if (this.confirmId !== null && key === 'escape') {
      ev.preventDefault();
      this.closeConfirm();
      return;
    }

    // Atajos de edición
    if (!this.editando) return;

    const isSave = key === 's' && (ev.ctrlKey || ev.metaKey);
    if (isSave) {
      ev.preventDefault();
      if (!this.guardando) this.guardarCambios();
      return;
    }
    if (key === 'escape') {
      ev.preventDefault();
      if (!this.guardando) this.cancelarEdicion();
    }
  }
}
