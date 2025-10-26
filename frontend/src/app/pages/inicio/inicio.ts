import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

type Destino = {
  nombre: string;
  departamento: string;
  imagen: string;
  resumen: string;
};

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.scss']
})
export class Inicio {
  readonly departamentos = [
    'Chuquisaca',
    'La Paz',
    'Cochabamba',
    'Oruro',
    'Potosí',
    'Tarija',
    'Santa Cruz',
    'Beni',
    'Pando'
  ];

  departamentoSeleccionado: string | null = null;
  a11yMensajeSeleccion = '';
  readonly heroDescId = 'hero-descripcion';
  selectedIndex: number | null = null;

  // Tres cards (centradas, grandes y con imagen en alta)
  readonly destinosPopulares: Destino[] = [
    {
      nombre: 'Salar de Uyuni',
      departamento: 'Potosí',
      imagen: 'https://res.cloudinary.com/dj5uzus8e/image/upload/v1759260470/salar_de_uyuni_potosi_l5ndhw.avif',
      resumen: 'El mayor desierto de sal del mundo; atardeceres únicos y cielos infinitos.'
    },
    {
      nombre: 'La Paz',
      departamento: 'La Paz',
      imagen: 'https://res.cloudinary.com/dj5uzus8e/image/upload/v1759260466/valle_de_la_luna_lapaz_eldxtf.webp',
      resumen: 'Ciudad en altura con teleféricos, cultura viva y el Valle de la Luna.'
    },
    {
      nombre: 'Sucre Histórico',
      departamento: 'Chuquisaca',
      imagen: 'https://res.cloudinary.com/dj5uzus8e/image/upload/v1759260472/centro_historico_chuquisaca_hfzgyx.jpg',
      resumen: 'Arquitectura colonial, museos y el corazón histórico del país.'
    }
  ];

  // Tamaños estimados de las cards para el grid: 3 cols desktop, 2 cols tablet, 1 col móvil
  readonly cardSizes = '(min-width: 1100px) 380px, (min-width: 700px) 44vw, 92vw';

  constructor(private router: Router) {}

  get puedeBuscarHoteles(): boolean {
    return !!this.departamentoSeleccionado && this.departamentoSeleccionado.trim().length > 0;
  }

  onDepartamentoChange(value: string | null): void {
    this.a11yMensajeSeleccion = value ? `Destino seleccionado: ${value}.` : '';
  }

  buscarHoteles(): void {
    if (!this.puedeBuscarHoteles) return;
    this.router.navigate(['/hoteles'], { queryParams: { departamento: this.departamentoSeleccionado } });
  }

  explorarTours(): void {
    this.router.navigate(['/paquetes']);
  }

  inspirarme(): void {
    const seed = this.departamentoSeleccionado
      ? `Quiero ideas de viaje en ${this.departamentoSeleccionado}: qué ver, cuántos días y un plan breve.`
      : 'Inspírame un viaje por Bolivia: mejores destinos según temporada, plan sugerido de 5 días.';
    this.router.navigate(['/asistente-ia'], { queryParams: { prompt: seed } });
  }

  verHotelesDestino(dep: string): void {
    this.router.navigate(['/hoteles'], { queryParams: { departamento: dep } });
  }

  verToursDestino(dep: string): void {
    this.router.navigate(['/paquetes'], { queryParams: { departamento: dep } });
  }

  selectCard(i: number): void {
    this.selectedIndex = this.selectedIndex === i ? null : i;
  }

  trackByDestino = (_: number, d: Destino) => d.nombre;

  // URL con transformaciones Cloudinary (nitidez sin peso excesivo)
  hiRes(url: string, w = 1280): string {
    if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
    return url.replace('/image/upload/', `/image/upload/f_auto,q_auto:good,w_${w},dpr_2/`);
  }

  // srcset responsive para las cards
  srcset(url: string): string {
    const widths = [480, 720, 960, 1280, 1600];
    return widths
      .map(w => `${this.hiRes(url, w)} ${w}w`)
      .join(', ');
  }

  // Color de acento por departamento (se usa como color de borde del card)
  accentColor(dep: string): string {
    const map: Record<string, string> = {
      'Potosí': '#f59e0b',
      'La Paz': '#0ea5e9',
      'Chuquisaca': '#22c55e',
      'Santa Cruz': '#16a34a',
      'Cochabamba': '#8b5cf6',
      'Oruro': '#ef4444',
      'Tarija': '#fb7185',
      'Beni': '#06b6d4',
      'Pando': '#10b981'
    };
    return map[dep] || '#22c55e';
  }
}
