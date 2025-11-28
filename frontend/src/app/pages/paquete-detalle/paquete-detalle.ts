import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaqueteService } from '../../services/paquete.service';
import { HabitacionService } from '../../services/habitacion.service';
import { Paquete } from '../../interfaces/paquete.interface';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { IconsModule } from '../../icons';
import { LoadingService } from '../../shared/services/loading';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

type MediaKind = 'lugar' | 'hotel';

@Component({
  selector: 'app-paquete-detalle',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    IconsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './paquete-detalle.html',
  styleUrls: ['./paquete-detalle.scss']
})
export class PaqueteDetalle implements OnInit, OnDestroy {
  paquete: Paquete | null = null;
  itinerario: string[] = [];
  infoImportante: string[] = [];
  error = '';
  isLoadingReserva = false;

  lugarImg: string = 'assets/no-image.svg';
  hotelImg: string = 'assets/no-image.svg';
  hasLugarImage = false;
  hasHotelImage = false;
  activeMedia: MediaKind = 'lugar';

  fechaReserva: string = '';
  fechaCaducidad: string = '';
  proxDisponible: string = '';
  showConflictModal = false;
  habitacionSeleccionada: Habitacion | null = null;
  mensajeFechaLibre = '';
  intervalosOcupados: { inicio: string; fin: string }[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paqueteService: PaqueteService,
    private readonly habitacionService: HabitacionService,
    private readonly loadingService: LoadingService
  ) {}

  // ==============================
  //   Ciclo de vida
  // ==============================
  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.loadingService.show('Cargando paquete...');

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error = 'ID de paquete no válido';
      this.loadingService.hide();
      return;
    }

    this.paqueteService.getPaqueteById(id).subscribe({
      next: (data) => {
        if (!data) {
          this.error = 'No se pudo cargar el paquete';
          this.loadingService.hide();
          return;
        }
        this.paquete = data;
        this.itinerario = (data as any).itinerario ?? [];
        this.infoImportante = (data as any).info_importante ?? [];
        this.prepareMedia(data);
        this.loadingService.hide();
      },
      error: (err) => {
        console.error(err);
        this.error = 'No se pudo cargar el paquete';
        this.loadingService.hide();
      }
    });
  }

  ngOnDestroy(): void {
    this.loadingService.hide();
  }

  // ==============================
  //   Helpers de fecha
  // ==============================

  /** Convierte lo que reciba a string de fecha local YYYY-MM-DD */
  private toDateOnly(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    // 1) Si ya es un Date (del datepicker)
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 2) Si es string, nos quedamos solo con la parte de fecha
    //    Ej: "2025-12-24" o "2025-12-24T00:00:00.000Z"
    const base = value.split('T')[0];

    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
      return base;
    }

    // 3) Fallback defensivo
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Suma días a una fecha string (YYYY-MM-DD) usando fecha local */
  private addDias(fecha: string, dias: number): string {
    const parts = fecha.split('-');
    if (parts.length === 3) {
      const [yStr, mStr, dStr] = parts;
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (y && m && d) {
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + dias);
        return this.toDateOnly(date);
      }
    }
    // fallback si el string viene en otro formato
    const base = new Date(fecha);
    base.setDate(base.getDate() + dias);
    return this.toDateOnly(base);
  }

  // ==============================
  //   Media
  // ==============================
  private prepareMedia(p: Paquete): void {
    const lugarRaw = (p.lugar?.url_image_lugar_turistico || '').trim();
    const hotelRaw = (p.hotel?.url_imagen_hotel || '').trim();
    this.hasLugarImage = !!lugarRaw;
    this.hasHotelImage = !!hotelRaw;
    this.lugarImg = this.hasLugarImage ? lugarRaw : 'assets/no-image.svg';
    this.hotelImg = this.hasHotelImage ? hotelRaw : 'assets/no-image.svg';

    if (this.hasLugarImage) this.activeMedia = 'lugar';
    else if (this.hasHotelImage) this.activeMedia = 'hotel';
    else this.activeMedia = 'lugar';
  }

  mediaFallback(evt: Event): void {
    const img = evt.target as HTMLImageElement;
    if (img && !img.src.endsWith('no-image.svg')) img.src = 'assets/no-image.svg';
  }

  thumbFallback(evt: Event): void {
    const img = evt.target as HTMLImageElement;
    if (img && !img.src.endsWith('no-image.svg')) img.src = 'assets/no-image.svg';
  }

  // ==============================
  //   Acciones generales
  // ==============================
  onReservarClick(evt: Event): void {
    if (this.isLoadingReserva) return;
    this.isLoadingReserva = true;

    // Fusible por si el backend tarda
    const safety = setTimeout(() => {
      console.warn('[reservar] timeout de seguridad, reseteando loading');
      this.isLoadingReserva = false;
    }, 12000);

    try {
      this.reservarPaquete();
    } catch (e) {
      console.error('[reservar] error sincrónico', e);
      this.isLoadingReserva = false;
      clearTimeout(safety);
    }
  }

  openMaps(): void {
    const q =
      this.paquete?.lugar?.ubicacion ||
      this.paquete?.hotel?.ubicacion ||
      `${this.paquete?.lugar?.nombre || ''} ${this.paquete?.hotel?.nombre || ''} ${this.paquete?.hotel?.departamento || ''}`.trim();

    if (!q) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async copyAddress(): Promise<void> {
    const text =
      this.paquete?.lugar?.ubicacion ||
      this.paquete?.hotel?.ubicacion ||
      `${this.paquete?.lugar?.nombre || ''} ${this.paquete?.hotel?.nombre || ''}`.trim();

    if (!text) return;
    await this.copyToClipboard(text);
    alert('Dirección copiada');
  }

  share(): void {
    const title =
      this.paquete?.nombre || `${this.paquete?.lugar?.nombre || 'Paquete'} + ${this.paquete?.hotel?.nombre || ''}`.trim();
    const price = this.paquete?.precio?.toFixed
      ? this.paquete.precio.toFixed(2)
      : String(this.paquete?.precio ?? '');
    const text = `${title} · ${price} BOB`;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
    } else {
      this.copyLink();
    }
  }

  async copyLink(): Promise<void> {
    await this.copyToClipboard(window.location.href);
    alert('Enlace copiado');
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {
      // ignoramos errores de clipboard
    }
  }

  // ==============================
  //   Fechas / disponibilidad
  // ==============================
  onChangeFechaReserva(): void {
    if (this.fechaReserva) {
      this.fechaCaducidad = this.addDias(this.fechaReserva, 1);
    }
  }

  reservarPaquete(): void {
    console.debug('[reservar] start');
    if (!this.paquete?.hotel?.id_hotel) {
      alert('No hay hotel asignado para este paquete.');
      this.isLoadingReserva = false;
      return;
    }

    this.habitacionService.getHabitaciones().subscribe({
      next: (habitaciones) => {
        console.debug('[reservar] habitaciones recibidas', habitaciones?.length ?? 0);
        const disponibles = (habitaciones || []).filter(
          (h: Habitacion) => h.codigo_hotel === this.paquete!.hotel!.id_hotel && (h as any).disponible
        );

        if (!disponibles.length) {
          alert('No hay habitaciones disponibles en este hotel.');
          this.isLoadingReserva = false;
          return;
        }

        this.habitacionSeleccionada = disponibles[0];

        this.habitacionService.getDisponibilidadHabitacion(this.habitacionSeleccionada.num).subscribe({
          next: (disp) => {
            console.debug('[reservar] disponibilidad', disp);
            this.intervalosOcupados = disp?.intervalos_reservados || [];

            const next = disp?.next_available_from
              ? disp.next_available_from
              : new Date();
            this.proxDisponible = this.toDateOnly(next as any);

            this.showConflictModal = true;
            this.fechaReserva = this.proxDisponible;
            this.fechaCaducidad = this.addDias(this.proxDisponible, 1);
            this.mensajeFechaLibre = '';
            this.isLoadingReserva = false;
          },
          error: (e) => {
            console.error('[reservar] error disponibilidad', e);
            const today = new Date();
            this.proxDisponible = this.toDateOnly(today);
            this.showConflictModal = true;
            this.fechaReserva = this.proxDisponible;
            this.fechaCaducidad = this.addDias(this.proxDisponible, 1);
            this.mensajeFechaLibre = '';
            this.isLoadingReserva = false;
          }
        });
      },
      error: (e) => {
        console.error('[reservar] error habitaciones', e);
        this.isLoadingReserva = false;
      }
    });
  }

  probarFechasPersonalizadas(): void {
    if (!this.habitacionSeleccionada || !this.fechaReserva || !this.fechaCaducidad) {
      alert('Selecciona ambas fechas para continuar.');
      return;
    }

    this.habitacionService.getDisponibilidadHabitacion(this.habitacionSeleccionada.num).subscribe({
      next: (disp) => {
        const reservado = (disp?.intervalos_reservados || []).some((it: any) =>
          this.toDateOnly(this.fechaReserva as any) <= it.fin &&
          this.toDateOnly(this.fechaCaducidad as any) >= it.inicio
        );

        if (reservado) {
          this.mensajeFechaLibre = '❌ Las fechas seleccionadas están ocupadas.';
        } else {
          this.mensajeFechaLibre = '🎉 ¡Felicidades! Las fechas seleccionadas están disponibles.';
          setTimeout(() => {
            this.showConflictModal = false;
            this.redirigirAReservas();
          }, 1200);
        }
      },
      error: () => {
        this.mensajeFechaLibre = 'No fue posible validar las fechas. Intenta nuevamente.';
      }
    });
  }

  cancelarReserva(): void {
    this.showConflictModal = false;
  }

  onRangeSelected(event: any): void {
    const range = event.value || event;
    const start: Date | null = range?.start ?? null;
    const end: Date | null = range?.end ?? null;

    if (start) this.fechaReserva = this.toDateOnly(start);
    if (end) this.fechaCaducidad = this.toDateOnly(end);

    // opcional: cerrar datepicker cuando el rango se completa
    if (start && end) {
      const btn = document.querySelector('.mat-datepicker-toggle');
      if (btn) (btn as HTMLElement).click();
    }
  }

  validarFecha = (d: Date | null): boolean => {
    if (!d) return true;
    const fecha = this.toDateOnly(d);

    return !this.intervalosOcupados.some((intervalo) =>
      fecha >= intervalo.inicio && fecha <= intervalo.fin
    );
  };

  estiloFecha = (d: Date): string => {
    const fecha = this.toDateOnly(d);

    for (const intervalo of this.intervalosOcupados) {
      if (fecha >= intervalo.inicio && fecha <= intervalo.fin) {
        return 'fecha-ocupada';
      }
    }
    return '';
  };

  redirigirAReservas(): void {
    if (!this.paquete || !this.habitacionSeleccionada) return;

    const inicio = this.toDateOnly(this.fechaReserva as any);
    const fin = this.toDateOnly(this.fechaCaducidad as any);

    this.router.navigate(['/reservas'], {
      queryParams: {
        num: this.habitacionSeleccionada.num,
        precio: this.paquete.precio,
        hotel: this.paquete.hotel?.id_hotel,
        capacidad: (this.habitacionSeleccionada as any).cant_huespedes,
        fecha_reserva: inicio,
        fecha_caducidad: fin,
        id_paquete: this.paquete.id_paquete
      }
    });
  }

  formatearFecha(fecha: string): string {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // ==============================
  //   Helpers de rating (estrellas)
  // ==============================
  private toStarScore10to5(score10: number): number {
    const s = Math.max(0, Math.min(10, Number(score10) || 0));
    return Math.round((s / 2) * 2) / 2;
  }

  getStarIcons(score10: number): ('full' | 'half' | 'empty')[] {
    const score5 = this.toStarScore10to5(score10);
    const full = Math.floor(score5);
    const half = score5 - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return [
      ...Array(full).fill('full' as const),
      ...Array(half).fill('half' as const),
      ...Array(empty).fill('empty' as const)
    ];
  }

  formatFiveScale(score10: number): string {
    return `${this.toStarScore10to5(score10).toFixed(1)}/5`;
  }
}
