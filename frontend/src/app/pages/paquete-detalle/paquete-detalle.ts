import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-paquete-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './paquete-detalle.html',
  styleUrls: ['./paquete-detalle.scss']
})
export class PaqueteDetalle implements OnInit {
  paquete: any;
  error = '';

  paquetes: any[] = [
    {
      id: '1',
      lugar_turistico: 'Cristo de la Concordia',
      hotel: 'Hotel La Casona',
      habitacion: 'R0004',
      codigo_hotel: 1,
      departamento: 'Cochabamba',
      descripcion: 'Monumento icónico ubicado en el Cerro San Pedro, con una estatua de 40 metros que domina el paisaje urbano. Incluye acceso al museo histórico, vistas panorámicas desde el mirador y recorrido guiado por la historia religiosa y cultural de la región.',
      precio: 216.25,
      tipo: 'cultural',
      inclusiones: ['Visita guiada', 'Entrada al museo', 'Transporte local', 'Guía bilingüe'],
      info_importante: ['Horario: 8 AM - 6 PM', 'Acceso por teleférico', 'Ropa cómoda recomendada'],
      itinerario: ['Día 1: Cristo y museo', 'Día 2: Recorrido cultural', 'Día 3: Actividades locales'],
      disponible: true,
      fecha_creacion: '2025-09-29',
      ubicacion: 'Cerro San Pedro'
    },
    {
      id: '2',
      lugar_turistico: 'Casa de la Libertad',
      hotel: 'Hotel Dorado',
      habitacion: 'R0006',
      codigo_hotel: 2,
      departamento: 'Chuquisaca',
      descripcion: 'Centro histórico donde se firmó el Acta de Independencia de Bolivia. El recorrido incluye salas coloniales, documentos originales y una experiencia inmersiva en la historia republicana del país.',
      precio: 150.50,
      tipo: 'historico',
      inclusiones: ['Entrada al museo', 'Guía especializado', 'Recorrido por Sucre'],
      info_importante: ['Horario: 9 AM - 6 PM', 'Grupos máximo de 10 personas'],
      itinerario: ['Día 1: Casa de la Libertad', 'Día 2: Tour histórico por Sucre'],
      disponible: true,
      fecha_creacion: '2025-09-30',
      ubicacion: 'Plaza 25 de Mayo'
    },
    {
      id: '3',
      lugar_turistico: 'Parque Nacional Madidi',
      hotel: 'EcoLodge Amazonia',
      habitacion: 'R0012',
      codigo_hotel: 3,
      departamento: 'La paz',
      descripcion: 'Reserva natural con más de 1,000 especies de fauna y flora. Ideal para ecoturismo, fotografía de vida silvestre y caminatas guiadas por expertos en biodiversidad. Incluye alojamiento ecológico y navegación por el río Tuichi.',
      precio: 320.00,
      tipo: 'naturaleza',
      inclusiones: ['Guía ecológica', 'Transporte fluvial', 'Alojamiento ecológico'],
      info_importante: ['Repelente obligatorio', 'Botas de trekking recomendadas'],
      itinerario: ['Día 1: Navegación río Tuichi', 'Día 2: Caminata por la selva', 'Día 3: Observación de aves'],
      disponible: true,
      fecha_creacion: '2025-10-01',
      ubicacion: 'Amazonía boliviana'
    },
    {
      id: '4',
      lugar_turistico: 'Salar de Uyuni',
      hotel: 'Hotel de Sal Luna',
      habitacion: 'R0009',
      codigo_hotel: 4,
      departamento: 'Potosí',
      descripcion: 'El salar más grande del mundo, con paisajes surrealistas que reflejan el cielo como un espejo. Incluye alojamiento en hotel construido completamente de sal, excursiones en 4x4 y visitas a lagunas altiplánicas.',
      precio: 410.75,
      tipo: 'aventura',
      inclusiones: ['Tour en 4x4', 'Guía local', 'Alojamiento en hotel de sal'],
      info_importante: ['Lentes de sol recomendados', 'Protección solar'],
      itinerario: ['Día 1: Salar y puesta de sol', 'Día 2: Isla Incahuasi', 'Día 3: Lagunas altiplánicas'],
      disponible: true,
      fecha_creacion: '2025-10-01',
      ubicacion: 'Región del Altiplano'
    },
    {
      id: '5',
      lugar_turistico: 'Cascadas de Arcoiris',
      hotel: 'Refugio Natural Samaipata',
      habitacion: 'R0015',
      codigo_hotel: 5,
      departamento: 'Santa Cruz',
      descripcion: 'Cascadas escondidas en medio de la selva tropical, rodeadas de vegetación exuberante. Ideal para senderismo, fotografía de naturaleza y relajación en un entorno ecológico. Incluye guía local y refrigerio típico.',
      precio: 185.00,
      tipo: 'naturaleza',
      inclusiones: ['Guía de senderismo', 'Transporte privado', 'Refrigerio local'],
      info_importante: ['Ropa impermeable', 'No apto para niños menores de 8 años'],
      itinerario: ['Día 1: Caminata a las cascadas', 'Día 2: Picnic ecológico'],
      disponible: true,
      fecha_creacion: '2025-10-02',
      ubicacion: 'Samaipata'
    },
    {
      id: '6',
      lugar_turistico: 'Ruta del Vino y Singani',
      hotel: 'Hotel Viñedos del Sur',
      habitacion: 'R0020',
      codigo_hotel: 6,
      departamento: 'Tarija',
      descripcion: 'Recorrido por los viñedos más emblemáticos de Bolivia. Incluye degustación de vinos y singani, visitas guiadas a bodegas artesanales y cena maridaje con productos locales. Ideal para amantes de la gastronomía y la cultura.',
      precio: 275.50,
      tipo: 'gastronomico',
      inclusiones: ['Degustación de vinos', 'Tour por bodegas', 'Cena tradicional'],
      info_importante: ['No apto para menores de edad', 'Vestimenta casual elegante'],
      itinerario: ['Día 1: Bodegas y viñedos', 'Día 2: Cena maridaje'],
      disponible: true,
      fecha_creacion: '2025-10-02',
      ubicacion: 'Valle Central de Tarija'
    }
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const encontrado = this.paquetes.find(p => p.id === id);
      if (encontrado) {
        this.paquete = encontrado;
      } else {
        this.error = 'Paquete no encontrado';
      }
    } else {
      this.error = 'ID de paquete no válido';
    }
  }

  constructor(private route: ActivatedRoute) {}

  getPrecioFormateado(): string {
    return this.paquete ? `${this.paquete.precio.toFixed(2)} BOB` : '';
  }

  getDuracion(): string {
    return this.paquete?.itinerario?.length
      ? `${this.paquete.itinerario.length} días`
      : 'Duración no especificada';
  }

  getGrupo(): string {
    const info = this.paquete?.info_importante?.find((i: string) =>
  i.toLowerCase().includes('grupo')
);

    return info || 'Grupo estándar';
  }
}
