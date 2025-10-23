import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';
import { AuthService } from '../../services/auth.service';
import { LugaresService, ActualizarLugarDTO } from '../../services/lugares.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Loading } from "../../loading/loading";

@Component({
  selector: 'app-lugares-turisticos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Loading],
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

  // Modal Editar
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

  // Modal Agregar
  showAddModal = false;
  savingAdd = false;
  addModel: Partial<LugarTuristico> = {
    id_lugar: 0,
    nombre: '',
    ubicacion: '',
    departamento: '',
    tipo: '',
    horario: '',
    descripcion: '',
    url_image_lugar_turistico: ''
  };

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

  // --- Métodos para Modal de Edición ---
  openEditModal(lugar: LugarTuristico) {
    if (!this.isSuperAdmin) return;
    this._editTargetRef = lugar;
    this.editModel = { ...lugar };
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
    
    this.lugaresService.actualizarLugar(this.editModel).subscribe({
      next: (resp) => {
        Object.assign(this._editTargetRef!, resp);
        this.aplicarFiltros();
        this.savingEdit = false;
        this.closeEditModal(false);
        alert('Lugar turístico actualizado');
        this._editTargetRef = null;
      },
      error: (err: HttpErrorResponse) => {
        this.savingEdit = false;
        console.error('Error al actualizar:', err.error);
        alert(`Error al actualizar el lugar turístico. Causa: ${JSON.stringify(err.error)}`);
      }
    });
  }

  // --- Métodos para Modal de Agregar ---
  openAddModal() {
    if (!this.isSuperAdmin) return;
    this.addModel = {
      id_lugar: undefined,
      nombre: '',
      ubicacion: '',
      departamento: '',
      tipo: '',
      horario: '',
      descripcion: '',
      url_image_lugar_turistico: ''
    };
    this.showAddModal = true;
    document.body.classList.add('no-scroll');
    this.savingAdd = false;
  }

  closeAddModal(discard = true) {
    if (this.savingAdd) return;
    this.showAddModal = false;
    document.body.classList.remove('no-scroll');
  }

  saveNewLugar(form: any) {
    if (!form.valid || !this.isSuperAdmin) return;
    
    if (!this.addModel.id_lugar || !this.addModel.nombre || !this.addModel.ubicacion || !this.addModel.departamento || !this.addModel.tipo) {
      alert('Completa todos los campos obligatorios (ID, Nombre, Ubicación, Departamento, Tipo).');
      return;
    }
    
    this.savingAdd = true;

    const today = new Date();
    const formattedDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const payload: Partial<LugarTuristico> = {
      ...this.addModel,
      fecha_creacion: formattedDate
    };
    
    this.lugaresService.agregarLugar(payload).subscribe({
      next: (lugarAgregado) => {
        this.lugares.unshift(lugarAgregado);
        this.aplicarFiltros();
        this.savingAdd = false;
        this.closeAddModal();
        alert('Lugar turístico agregado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.savingAdd = false;
        console.error('Error al agregar:', err);

        if (err.error && err.error.nombre) {
          alert(`Error: ${err.error.nombre[0]}`);
        } else if (err.error && err.error.id_lugar) {
           alert(`Error: ${err.error.id_lugar[0]}`);
        } else {
          alert(`Error al agregar el lugar turístico. Por favor, revisa los datos.`);
        }
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

