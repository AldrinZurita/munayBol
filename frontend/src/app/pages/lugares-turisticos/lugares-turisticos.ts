import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';
import { AuthService } from '../../services/auth.service';
import { LugaresService, CrearLugarDTO, ActualizarLugarDTO } from '../../services/lugares.service';

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

  // Modal
  showEditModal = false;
  savingEdit = false;

  editModel: LugarTuristico = {
    id_lugar: 0,
    nombre: '',
    ubicacion: '',
    departamento: '',
    tipo: '',
    fecha_creacion: '',
    horario: '',
    descripcion: '',
    url_image_lugar_turistico: ''
  };
  private _editTargetRef: LugarTuristico | null = null;

  constructor(
    private lugaresService: LugaresService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargando = true;
    this.lugaresService.getLugares().subscribe({
      next: (rows) => {
        this.lugares = rows ?? [];
        const allCities = this.lugares
          .map((l) => (l?.departamento ?? '').toString().trim())
          .filter((s) => s.length > 0);
        this.ciudades = Array.from(new Set(allCities)).sort((a, b) => a.localeCompare(b));
        this.lugaresFiltrados = [...this.lugares];
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de lugares';
        this.cargando = false;
      },
    });
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperadmin();
  }

  aplicarFiltros(): void {
    let filtrados = this.lugares;
    if (this.ciudadSeleccionada) {
      filtrados = filtrados.filter((l) => l.departamento === this.ciudadSeleccionada);
    }
    this.lugaresFiltrados = filtrados;
  }

  onAgregarLugar(): void {
    if (!this.isSuperAdmin) return;
    const nombre = prompt('Nombre del lugar:')?.trim();
    const ubicacion = prompt('Ubicación o dirección:')?.trim();
    const departamento = prompt('Departamento:')?.trim();
    const tipo = prompt('Tipo (ej. Museo, Parque Nacional):')?.trim();
    const horario = prompt('Horario (opcional):')?.trim() || undefined;
    const descripcion = prompt('Descripción (opcional):')?.trim() || undefined;
    const url_image_lugar_turistico = prompt('URL de la imagen (opcional):')?.trim() || undefined;
    if (nombre && ubicacion && departamento && tipo) {
      const nuevo: CrearLugarDTO = {
        nombre, ubicacion, departamento, tipo, horario, descripcion, url_image_lugar_turistico
      };
      this.lugaresService.agregarLugar(nuevo).subscribe({
        next: (lugarAgregado) => {
          this.lugares.push(lugarAgregado);
          this.aplicarFiltros();
          alert('Lugar turístico agregado correctamente');
        },
        error: () => alert('Error al agregar el lugar turístico'),
      });
    }
  }

  onEliminarLugar(lugar: LugarTuristico): void {
    if (!this.isSuperAdmin) return;
    if (confirm(`¿Estás seguro de que quieres eliminar "${lugar.nombre}"?`)) {
      this.lugaresService.eliminarLugar(lugar.id_lugar).subscribe({
        next: () => {
          this.lugares = this.lugares.filter((l) => l.id_lugar !== lugar.id_lugar);
          this.aplicarFiltros();
          alert('Lugar turístico eliminado');
        },
        error: () => alert('Error al eliminar el lugar turístico'),
      });
    }
  }

  openEditModal(lugar: LugarTuristico) {
    if (!this.isSuperAdmin) return;
    this._editTargetRef = lugar;
    this.editModel = {
      id_lugar: lugar.id_lugar,
      nombre: lugar.nombre ?? '',
      ubicacion: lugar.ubicacion ?? '',
      departamento: lugar.departamento ?? '',
      tipo: lugar.tipo ?? '',
      fecha_creacion: lugar.fecha_creacion ?? '',
      horario: lugar.horario ?? '',
      descripcion: lugar.descripcion ?? '',
      url_image_lugar_turistico: lugar.url_image_lugar_turistico ?? ''
    };
    this.showEditModal = true;
    document.body.classList.add('no-scroll');
    this.savingEdit = false;
  }

  closeEditModal(discard = true) {
    if (this.savingEdit) return;
    this.showEditModal = false;
    document.body.classList.remove('no-scroll');
    if (discard) this._editTargetRef = null;
  }

  saveEdit(form: any) {
    if (!form.valid || !this._editTargetRef || !this.isSuperAdmin) return;
    this.savingEdit = true;
    const cambios: ActualizarLugarDTO = {
      nombre: this.editModel.nombre,
      ubicacion: this.editModel.ubicacion,
      departamento: this.editModel.departamento,
      tipo: this.editModel.tipo,
      horario: this.editModel.horario,
      descripcion: this.editModel.descripcion,
      url_image_lugar_turistico: this.editModel.url_image_lugar_turistico
    };
    this.lugaresService.actualizarLugar(this.editModel.id_lugar, cambios).subscribe({
      next: (resp) => {
        Object.assign(this._editTargetRef!, resp);
        this.aplicarFiltros();
        this.savingEdit = false;
        this.closeEditModal(false);
        alert('Lugar turístico actualizado');
        this._editTargetRef = null;
      },
      error: () => {
        this.savingEdit = false;
        alert('Error al actualizar el lugar turístico');
      }
    });
  }

  trackByLugar = (_: number, item: LugarTuristico) => item.id_lugar;

  onImageError(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
          <rect width="100%" height="100%" fill="#f1f5f9"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="14">Imagen no disponible</text>
        </svg>`
      );
  }
}