import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';
import { AdminAuthService } from '../../services/admin-auth.service';
import { LugaresService } from '../../services/lugares.service'; 

@Component({
  selector: 'app-lugares-turisticos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './lugares-turisticos.html',
  styleUrls: ['./lugares-turisticos.scss'],
})
export class LugaresTuristicos implements OnInit {
  lugares: LugarTuristico[] = [];
  lugaresFiltrados: LugarTuristico[] = [];
  ciudades: string[] = [];
  ciudadSeleccionada = '';
  cargando = false;
  error = '';
  isSuperAdmin = false;

  constructor(
    private lugaresService: LugaresService, // CORREGIDO: Inyecta el servicio correcto
    private authService: AdminAuthService
  ) {}

  ngOnInit(): void {
    this.cargando = true;
    this.isSuperAdmin = this.authService.isLoggedIn();

    // Se utiliza el servicio y método correcto
    this.lugaresService.getLugares().subscribe({
      next: (rows) => {
        this.lugares = rows;
        const allCities = this.lugares
          .map(l => String(l.departamento ?? '').trim())
          .filter(s => s.length > 0);
        this.ciudades = Array.from(new Set(allCities)).sort();
        this.lugaresFiltrados = [...this.lugares];
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de lugares';
        this.cargando = false;
      }
    });
  }

  aplicarFiltros(): void {
    let filtrados = this.lugares;
    if (this.ciudadSeleccionada) {
      filtrados = filtrados.filter(l => l.departamento === this.ciudadSeleccionada);
    }
    this.lugaresFiltrados = filtrados;
  }

  onAgregarLugar(): void {
    const nombre = prompt('Nombre del lugar:')?.trim();
    const departamento = prompt('Departamento:')?.trim();
    const tipo = prompt('Tipo (ej. Museo, Parque Nacional):')?.trim();
    const ubicacion = prompt('Ubicación o dirección:')?.trim();
    const url_image_lugar_turistico = prompt('URL de la imagen:')?.trim();

    if (nombre && departamento) {
      const nuevoLugar: Partial<LugarTuristico> = {
        nombre,
        departamento,
        tipo,
        ubicacion,
        url_image_lugar_turistico
      };
      this.lugaresService.agregarLugar(nuevoLugar).subscribe({
        next: lugarAgregado => {
          this.lugares.push(lugarAgregado);
          this.aplicarFiltros();
          alert('Lugar turístico agregado correctamente');
        },
        error: () => alert('Error al agregar el lugar turístico')
      });
    }
  }

  onEditarLugar(lugar: LugarTuristico): void {
    const nombre = prompt('Nuevo nombre:', lugar.nombre)?.trim();
    const departamento = prompt('Nuevo departamento:', lugar.departamento)?.trim();
    const tipo = prompt('Nuevo tipo:', lugar.tipo)?.trim();
    const ubicacion = prompt('Nueva ubicación:', lugar.ubicacion)?.trim();
    const url_image_lugar_turistico = prompt('Nueva URL de imagen:', lugar.url_image_lugar_turistico)?.trim();

    if (nombre && departamento) {
      const lugarActualizado: LugarTuristico = {
        ...lugar,
        nombre,
        departamento,
        tipo: tipo || '',
        ubicacion: ubicacion || '',
        url_image_lugar_turistico: url_image_lugar_turistico || ''
      };
      this.lugaresService.actualizarLugar(lugarActualizado).subscribe({
        next: lugarRespuesta => {
          Object.assign(lugar, lugarRespuesta);
          this.aplicarFiltros();
          alert('Lugar turístico actualizado');
        },
        error: () => alert('Error al actualizar el lugar turístico')
      });
    }
  }

  onEliminarLugar(lugar: LugarTuristico): void {
    if (confirm(`¿Estás seguro de que quieres eliminar "${lugar.nombre}"?`)) {
      this.lugaresService.eliminarLugar(lugar.id_lugar).subscribe({
        next: () => {
          this.lugares = this.lugares.filter(l => l.id_lugar !== lugar.id_lugar);
          this.aplicarFiltros();
          alert('Lugar turístico eliminado');
        },
        error: () => alert('Error al eliminar el lugar turístico')
      });
    }
  }
}

