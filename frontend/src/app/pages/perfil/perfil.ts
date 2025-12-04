import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router'; // 👈 Se añadió 'Router' aquí
import { forkJoin, of, Observable } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ReservasService } from '../../services/reservas.service';
import { HotelService } from '../../services/hotel.service';
import { PaqueteService } from '../../services/paquete.service';
import { LugaresService } from '../../services/lugares.service';
import { LoadingService } from '../../shared/services/loading';
import { Usuario } from '../../interfaces/usuario.interface';
import { Hotel } from '../../interfaces/hotel.interface';
import { Paquete } from '../../interfaces/paquete.interface';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';
const CONFIRM_TRANSITION_MS = 300;
interface Reserva {
  id_reserva: number;
  estado: boolean;
  fecha_reserva: string | Date;
  codigo_hotel?: number;
  id_paquete?: number;
  fecha_entrada: string | Date;
  fecha_salida: string | Date;
  numero_huespedes: number;
  num_habitacion?: number | string;
  fecha_caducidad?: string | Date;
}
type ReservaEnriquecida = Reserva & {
  hotel?: Hotel;
  paquete?: Paquete;
  lugar?: LugarTuristico;
};

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.scss']
})
export class Perfil implements OnInit, OnDestroy {
  usuario: Usuario | null = null;
  editando = false;
  guardando = false;
  errorGuardar = '';
  form: Partial<Pick<Usuario, 'nombre' | 'pais' | 'pasaporte' | 'avatar_url'>> = {
    nombre: '', pais: '', pasaporte: '', avatar_url: ''
  };

  reservas: ReservaEnriquecida[] = [];
  errorReservas = '';

  cancelling: Set<number> = new Set<number>();
  removing: Set<number> = new Set<number>();
  confirmId: number | null = null;

  animateFun = false;
  private funTimer?: any;

  constructor(
    private authService: AuthService,
    private reservasService: ReservasService,
    private hotelService: HotelService,
    private paqueteService: PaqueteService,
    private lugaresService: LugaresService,
    private loadingService: LoadingService,
    private router: Router // 👈 Se inyectó 'Router' aquí
  ) {}

  ngOnInit(): void {
    this.loadingService.show('Cargando tu perfil...');
    this.loadingService.setProgress(10);

    this.usuario = this.authService.getUser();

    if (this.usuario) {
      this.form = {
        nombre: this.usuario.nombre,
        pais: this.usuario.pais,
        pasaporte: this.usuario.pasaporte,
        avatar_url: this.usuario.avatar_url || ''
      };

      this.loadingService.setProgress(30);

      this.reservasService.getMisReservas().pipe(
        switchMap(reservas => {
          this.loadingService.setProgress(50);
          if (!reservas || reservas.length === 0) {
            return of<ReservaEnriquecida[]>([]);
          }
          const reservasReales = (reservas as any) as Reserva[];
          const hotelIds = [...new Set(reservasReales.map(r => r.codigo_hotel).filter(id => !!id))] as number[];
          const paqueteIds = [...new Set(reservasReales.map(r => r.id_paquete).filter(id => !!id))] as number[];
          const hotelRequests$ = hotelIds.length > 0 ?
            forkJoin(hotelIds.map(id =>
              this.hotelService.getHotelById(id).pipe(catchError(() => of(undefined)))
            )) : of([]);
          const paqueteRequests$ = paqueteIds.length > 0 ?
            forkJoin(paqueteIds.map(id =>
              this.paqueteService.getPaqueteById(id).pipe(catchError(() => of(undefined)))
            )) : of([]);
          return forkJoin({
            hoteles: hotelRequests$ as Observable<(Hotel | undefined)[]>,
            paquetes: paqueteRequests$ as Observable<(Paquete | undefined)[]>
          }).pipe(
            switchMap(({ hoteles, paquetes }) => {
              this.loadingService.setProgress(70);
              const hotelMap = new Map(hoteles.filter((h): h is Hotel => !!h).map(h => [h.id_hotel, h]));
              const paqueteMap = new Map(paquetes.filter((p): p is Paquete => !!p).map(p => [p.id_paquete, p]));
              const lugarIds = [...new Set(paquetes.filter((p): p is Paquete => !!p).map(p => p.id_lugar).filter(id => !!id))] as number[];
              const lugarRequests$ = lugarIds.length > 0 ?
                forkJoin(lugarIds.map(id =>
                  this.lugaresService.getLugarById(id).pipe(catchError(() => of(undefined)))
                )) : of([]);
              return (lugarRequests$ as Observable<(LugarTuristico | undefined)[] >).pipe(
                map(lugares => {
                  this.loadingService.setProgress(90);
                  const lugarMap = new Map(lugares.filter((l): l is LugarTuristico => !!l).map(l => [l.id_lugar, l]));
                  const enriched = reservasReales.map(reserva => {
                    const hotel = reserva.codigo_hotel ? hotelMap.get(reserva.codigo_hotel) : undefined;
                    const paquete = reserva.id_paquete ? paqueteMap.get(reserva.id_paquete) : undefined;
                    const lugar = (paquete && paquete.id_lugar) ? lugarMap.get(paquete.id_lugar) : undefined;
                    return { ...reserva, hotel, paquete, lugar };
                  });
                  return enriched.sort((a, b) => new Date(b.fecha_reserva as any).getTime() - new Date(a.fecha_reserva as any).getTime());
                })
              );
            })
          );
        })
      ).subscribe({
        next: (reservasConTodo) => {
          this.reservas = reservasConTodo;
          this.loadingService.hide();
          if (reservasConTodo.length > 0) {
            setTimeout(() => {
              this.triggerFun(1600);
            }, 300);
          }
        },
        error: (err) => {
          console.error("Error al cargar reservas y datos:", err);
          this.errorReservas = 'No se pudieron cargar tus reservas.';
          this.loadingService.hide();
        }
      });
    } else {
      this.loadingService.hide();
    }
  }

  ngOnDestroy(): void {
    this.loadingService.hide();
    if (this.funTimer) clearTimeout(this.funTimer);
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

  // 🌟 FUNCIÓN AÑADIDA PARA MANEJAR LA NAVEGACIÓN PROGRAMÁTICAMENTE 🌟
  verDetallePaquete(idPaquete: number | undefined): void {
    if (idPaquete) {
      // Navega a la ruta absoluta del detalle del paquete.
      // Si el error persiste, la ruta 'paquetes/detalle' en tu configuración de routing es incorrecta.
      this.router.navigate(['/paquetes/detalle', idPaquete]);
    } else {
      console.error('Intento de navegar al detalle del paquete sin un ID válido.');
      // Opcional: Navegar a una página de error o a la lista de paquetes
      // this.router.navigate(['/paquetes']);
    }
  }
  // ------------------------------------------------------------------

  confirmarCancel(reserva: ReservaEnriquecida): void {
    if (!reserva.estado || this.cancelling.has(reserva.id_reserva)) return;
    this.cancelling.add(reserva.id_reserva);
    this.removing.add(reserva.id_reserva);
    this.reservasService.cancelarReserva(reserva.id_reserva).subscribe({
      next: () => {
        setTimeout(() => {
          this.reservas = this.reservas.filter(r => r.id_reserva !== reserva.id_reserva);
          this.cancelling.delete(reserva.id_reserva);
          this.removing.delete(reserva.id_reserva);
          this.confirmId = null;
          this.triggerFun(800);
        }, CONFIRM_TRANSITION_MS);
      },
      error: (err) => {
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
        this.triggerFun(800);
      },
      error: (err) => {
        this.errorGuardar = this.leerError(err) || 'No se pudo guardar. Intenta nuevamente.';
        this.guardando = false;
      }
    });
  }

  trackByReserva = (_: number, item: ReservaEnriquecida) => item.id_reserva;

  onAvatarError(evt: Event): void {
    (evt.target as HTMLImageElement).src = 'https://via.placeholder.com/96/e6ebf5/4a5568?text=Error';
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

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    const key = ev.key.toLowerCase();

    if (this.confirmId !== null && key === 'escape') {
      ev.preventDefault();
      this.closeConfirm();
      return;
    }

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
