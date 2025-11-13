import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LugaresService } from '../../services/lugares.service';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';
import { LoadingService } from '../../shared/services/loading';

@Component({
  selector: 'app-lugares-turisticos-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './lugares-turisticos-detalle.html',
  styleUrls: ['./lugares-turisticos-detalle.scss'],
})
export class LugaresTuristicosDetalle implements OnInit, OnDestroy {
  lugar: LugarTuristico | null = null;
  error = '';
  heroImage = 'assets/no-image.svg';
  showFullDesc = false;
  isISODate = false;

  constructor(
    private route: ActivatedRoute,
    private lugaresService: LugaresService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.loadingService.show('Cargando lugar...');

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error = 'Identificador de lugar inválido';
      this.loadingService.hide();
      return;
    }

    this.lugaresService.getLugarByIdLocal(id).subscribe({
      next: (lugar) => {
        if (!lugar) {
          this.error = 'No se encontró el lugar solicitado';
          this.loadingService.hide();
          return;
        }
        this.lugar = lugar;
        this.heroImage = this.cleanUrl(lugar.url_image_lugar_turistico) || 'assets/no-image.svg';
        this.isISODate = this.looksLikeISODate(lugar.fecha_creacion);
        this.loadingService.hide();
      },
      error: () => {
        this.error = 'No se pudo cargar el lugar';
        this.loadingService.hide();
      }
    });
  }
  ngOnDestroy(): void {
    this.loadingService.hide();
  }
  private cleanUrl(url?: string): string {
    if (!url) return '';
    const s = String(url).trim();
    return s.length > 0 ? s : '';
  }

  private looksLikeISODate(s: string): boolean {
    if (!s) return false;
    const short = /^\d{4}-\d{2}-\d{2}$/;
    const iso = /^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|([+\-]\d{2}:\d{2}))?)?$/;
    return short.test(s) || iso.test(s);
  }
  onHeroError(evt: Event): void {
    const img = evt.target as HTMLImageElement;
    img.src = 'assets/no-image.svg';
  }

  openMaps(): void {
    const query = this.lugar?.ubicacion || `${this.lugar?.nombre || ''} ${this.lugar?.departamento || ''}`.trim();
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async copyAddress(): Promise<void> {
    const text = this.lugar?.ubicacion || `${this.lugar?.nombre || ''} ${this.lugar?.departamento || ''}`.trim();
    await this.copyToClipboard(text || window.location.href);
    alert('Dirección copiada');
  }

  async copyLink(): Promise<void> {
    await this.copyToClipboard(window.location.href);
    alert('Enlace copiado');
  }

  share(): void {
    const title = this.lugar?.nombre || 'Lugar turístico';
    const text = `Descubre ${this.lugar?.nombre} en ${this.lugar?.departamento || ''}`;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {/* ignore */});
    } else {
      this.copyToClipboard(url).then(() => alert('Enlace copiado'));
    }
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

  shouldClamp(desc: string | undefined): boolean {
    return (desc || '').length > 220;
  }
}
