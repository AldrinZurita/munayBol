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
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material/core';
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
  fechaReserva = '';
  fechaCaducidad = '';
  proxDisponible = '';
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

  onReservarClick(evt: Event): void {
  if (this.isLoadingReserva) return;
  this.isLoadingReserva = true;

  // “fusible” por si el backend tarda o algo falla silenciosamente
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
    const title = this.paquete?.nombre || `${this.paquete?.lugar?.nombre || 'Paquete'} + ${this.paquete?.hotel?.nombre || ''}`.trim();
    const price = this.paquete?.precio?.toFixed ? this.paquete.precio.toFixed(2) : String(this.paquete?.precio ?? '');
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
    }
  }

  onChangeFechaReserva(): void {
    if (this.fechaReserva) {
      this.fechaCaducidad = this.addDias(this.fechaReserva, 1);
    }
  }

reservarPaquete(): void {
  console.debug('[reservar] start');
  if (!this.paquete?.hotel?.id_hotel) {
    alert('No hay hotel asignado para este paquete.');
    this.isLoadingReserva = false; // <- reset en salida temprana
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
        this.isLoadingReserva = false; // <- reset
        return;
      }

      this.habitacionSeleccionada = disponibles[0];

      this.habitacionService.getDisponibilidadHabitacion(this.habitacionSeleccionada.num).subscribe({
        next: (disp) => {
          console.debug('[reservar] disponibilidad', disp);
          this.intervalosOcupados = disp?.intervalos_reservados || [];
          this.proxDisponible = disp?.next_available_from || new Date().toISOString().slice(0, 10);
          this.showConflictModal = true;
          this.fechaReserva = this.proxDisponible;
          this.fechaCaducidad = this.addDias(this.proxDisponible, 1);
          this.mensajeFechaLibre = '';
          this.isLoadingReserva = false; // <- se apaga al abrir modal
        },
        error: (e) => {
          console.error('[reservar] error disponibilidad', e);
          this.proxDisponible = new Date().toISOString().slice(0, 10);
          this.showConflictModal = true;
          this.fechaReserva = this.proxDisponible;
          this.fechaCaducidad = this.addDias(this.proxDisponible, 1);
          this.mensajeFechaLibre = '';
          this.isLoadingReserva = false; // <- reset en error
        }
      });
    },
    error: (e) => {
      console.error('[reservar] error habitaciones', e);
      this.isLoadingReserva = false; // <- reset en error
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
          this.fechaReserva <= it.fin && this.fechaCaducidad >= it.inicio
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


  onRangeSelected(event: any) {
   if (event.start && event.end) {
     const btn = document.querySelector('.mat-datepicker-toggle');
     if (btn) (btn as HTMLElement).click();
   }
  }

  validarFecha = (d: Date | null): boolean => {
  if (!d) return true;

  const fecha = d.toISOString().slice(0, 10);
  console.log("Chequeando fecha", fecha, this.intervalosOcupados);

  for (const intervalo of this.intervalosOcupados) {
    if (fecha >= intervalo.inicio && fecha <= intervalo.fin) {
      return false;
    }
  }
  return true;
};



  estiloFecha = (d: Date): string => {
  const fecha = d.toISOString().slice(0, 10);

  for (const intervalo of this.intervalosOcupados) {
    if (fecha >= intervalo.inicio && fecha <= intervalo.fin) {
      return 'fecha-ocupada';
    }
  }
  return '';
};


  redirigirAReservas(): void {
    if (!this.paquete || !this.habitacionSeleccionada) return;

    this.router.navigate(['/reservas'], {
      queryParams: {
        num: this.habitacionSeleccionada.num,
        precio: this.paquete.precio,
        hotel: this.paquete.hotel?.id_hotel,
        capacidad: (this.habitacionSeleccionada as any).cant_huespedes,
        fecha_reserva: this.fechaReserva,
        fecha_caducidad: this.fechaCaducidad,
        id_paquete: this.paquete.id_paquete
      }
    });
  }

  formatearFecha(fecha: string): string {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private addDias(fecha: string, dias: number): string {
    const d = new Date(fecha);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  private toStarScore10to5(score10: number): number {
    const s = Math.max(0, Math.min(10, Number(score10) || 0));
    return Math.round((s / 2) * 2) / 2;
  }
  getStarIcons(score10: number): ('full'|'half'|'empty')[] {
    const score5 = this.toStarScore10to5(score10);
    const full = Math.floor(score5);
    const half = score5 - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return [
      ...Array(full).fill('full' as const),
      ...Array(half).fill('half' as const),
      ...Array(empty).fill('empty' as const),
    ];
  }
  formatFiveScale(score10: number): string {
    return `${this.toStarScore10to5(score10).toFixed(1)}/5`;
  }
}
