import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-paquetes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './paquetes.html',
  styleUrls: ['./paquetes.scss']
})
export class Paquetes implements OnInit {
  paquetes: any[] = [
    {
      id: '1',
      lugar_turistico: 'Cristo de la Concordia',
      hotel: 'Hotel La Casona',
      habitacion: 'R0004',
      codigo_hotel: 1,
      departamento: 'Cochabamba',
      descripcion: 'Monumento icónico con vista panorámica de la ciudad y museo histórico en su base.',
      precio: 220,
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
      descripcion: 'Museo donde se firmó el Acta de Independencia de Bolivia en 1825.',
      precio: 150,
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
      descripcion: 'Reserva natural con biodiversidad única, ideal para ecoturismo y fotografía de fauna.',
      precio: 320,
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
      descripcion: 'El salar más grande del mundo, famoso por su paisaje surrealista y espejos naturales.',
      precio: 410,
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
      descripcion: 'Cascadas escondidas en medio de la selva, ideales para senderismo y fotografía.',
      precio: 185,
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
      descripcion: 'Experiencia gastronómica y cultural en los viñedos más importantes de Bolivia.',
      precio: 275,
      tipo: 'gastronomico',
      inclusiones: ['Degustación de vinos', 'Tour por bodegas', 'Cena tradicional'],
      info_importante: ['No apto para menores de edad', 'Vestimenta casual elegante'],
      itinerario: ['Día 1: Bodegas y viñedos', 'Día 2: Cena maridaje'],
      disponible: true,
      fecha_creacion: '2025-10-02',
      ubicacion: 'Valle Central de Tarija'
    }
  ];

  paquetesFiltrados: any[] = [];
  disponibleSeleccionado = '';
  departamentoSeleccionado = '';
  tipoSeleccionado = '';
  departamentos: string[] = ['Cochabamba', 'Chuquisaca', 'Beni', 'Pando', 'Santa Cruz', 'Tarija', 'La Paz', 'Oruro'];
  cargando = false;
  error = '';
  isSuperAdmin = false;

  // Modal edición
  mostrarModalEditar = false;
  paqueteEditando: any = null;
  inclusionesTexto = '';
  infoImportanteTexto = '';
  itinerarioTexto = '';

  constructor(private authService: AuthService) {}
  
  ngOnInit() {
    this.isSuperAdmin = this.authService.isLoggedIn();
    this.paquetesFiltrados = [...this.paquetes];
  }

  aplicarFiltros() {
    let filtrados = this.paquetes;

    if (this.disponibleSeleccionado) {
      const disponible = this.disponibleSeleccionado === 'true';
      filtrados = filtrados.filter(p => p.disponible === disponible);
    }

    if (this.departamentoSeleccionado) {
      filtrados = filtrados.filter(p => p.departamento === this.departamentoSeleccionado);
    }

    if (this.tipoSeleccionado) {
      filtrados = filtrados.filter(p => p.tipo === this.tipoSeleccionado);
    }

    this.paquetesFiltrados = filtrados;
  }

  // Nuevo método para abrir el modal de edición
  onEditarPaquete(paquete: any) {
    this.paqueteEditando = { ...paquete };
    this.inclusionesTexto = paquete.inclusiones.join(', ');
    this.infoImportanteTexto = paquete.info_importante.join(', ');
    this.itinerarioTexto = paquete.itinerario.join(', ');
    this.mostrarModalEditar = true;
  }

  // Método para cerrar el modal
  cerrarModal() {
    this.mostrarModalEditar = false;
    this.paqueteEditando = null;
    this.inclusionesTexto = '';
    this.infoImportanteTexto = '';
    this.itinerarioTexto = '';
  }

  // Método para guardar los cambios del formulario
  guardarEdicion() {
    if (this.paqueteEditando) {
      // Convertir textos a arrays
      this.paqueteEditando.inclusiones = this.inclusionesTexto.split(',').map((item: string) => item.trim()).filter((item: string) => item);
      this.paqueteEditando.info_importante = this.infoImportanteTexto.split(',').map((item: string) => item.trim()).filter((item: string) => item);
      this.paqueteEditando.itinerario = this.itinerarioTexto.split(',').map((item: string) => item.trim()).filter((item: string) => item);

      const index = this.paquetes.findIndex(p => p.id === this.paqueteEditando.id);
      if (index !== -1) {
        this.paquetes[index] = { ...this.paqueteEditando };
        this.aplicarFiltros();
        this.cerrarModal();
        alert('Paquete actualizado correctamente');
      }
    }
  }

  onAgregarPaquete() {
    const lugar_turistico = prompt('Lugar turístico:')?.trim();
    const hotel = prompt('Nombre del hotel:')?.trim();
    const habitacion = prompt('Nombre de la habitación:')?.trim();
    const codigo_hotel = Number(prompt('Código hotel:'));
    const departamento = prompt('Departamento:');
    const descripcion = prompt('Descripción:');
    const precio = Number(prompt('Precio:'));
    const tipo = prompt('Tipo (aventura, cultural, naturaleza, historico, gastronomico):');
    const inclusiones = prompt('Inclusiones (separadas por comas):')?.split(',').map(i => i.trim());
    const info_importante = prompt('Información importante (separada por comas):')?.split(',').map(i => i.trim());
    const itinerario = prompt('Itinerario (separado por comas):')?.split(',').map(i => i.trim());
    const disponible = confirm('¿Disponible?');
    const ubicacion = prompt('Ubicación:')?.trim();

    if (lugar_turistico && hotel && habitacion && !isNaN(codigo_hotel) && departamento && descripcion && !isNaN(precio) && tipo && inclusiones && info_importante && itinerario && ubicacion) {
      const nuevoPaquete = {
        id: String(this.paquetes.length + 1),
        lugar_turistico,
        hotel,
        habitacion,
        codigo_hotel,
        departamento,
        descripcion,
        precio,
        tipo,
        inclusiones,
        info_importante,
        itinerario,
        disponible,
        fecha_creacion: new Date().toISOString().split('T')[0],
        ubicacion
      };
      this.paquetes.push(nuevoPaquete);
      this.aplicarFiltros();
      alert('Paquete agregado correctamente');
    }
  }

  onEliminarPaquete(paquete: any) {
    if (confirm('¿Eliminar paquete?')) {
      this.paquetes = this.paquetes.filter(p => p.id !== paquete.id);
      this.aplicarFiltros();
      alert('Paquete eliminado');
    }
  }
}