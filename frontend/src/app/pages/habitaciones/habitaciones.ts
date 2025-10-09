import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ActualizarLugarDTO, HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { empty } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-habitaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './habitaciones.html',
  styleUrls: ['./habitaciones.scss']
})
export class Habitaciones implements OnInit {
  habitaciones: Habitacion[] = [];
  habitacionesFiltradas: Habitacion[] = [];
  disponibleSeleccionado = '';
  hotelSeleccionado = '';
  hoteles: number[] = [];
  cargando = false;
  error = '';
  showEditModal = false;
  savingEdit = false;
  editModel: Habitacion = {
    num: '',
    caracteristicas: '',
    precio: 0,
    codigo_hotel: 0,
    disponible: false,
    fecha_creacion: '',
    cant_huespedes: 0
  }

  private _editTargetRef: Habitacion | null = null;
    newModel: Habitacion = {
    num: '',
    caracteristicas: '',
    precio: 0,
    codigo_hotel: 0,
    disponible: true,
    fecha_creacion: '',
    cant_huespedes: 0
  };

  showAddModal: boolean | undefined;
  savingAdd: boolean | undefined;
  
  constructor(
    private habitacionService: HabitacionService,
    public authService: AuthService
  ) { }

  ngOnInit() {
    this.cargando = true;
    this.habitacionService.getHabitaciones().subscribe({
      next: habitaciones => {
        this.habitaciones = habitaciones;
        this.hoteles = [
          ...new Set(habitaciones.map(h => h.codigo_hotel))
        ];
        this.habitacionesFiltradas = [...habitaciones];
        this.cargando = false;
      },
      error: err => {
        this.error = 'No se pudo cargar la lista de habitaciones';
        this.cargando = false;
      }
    });
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperadmin();
  }

  aplicarFiltros() {
    let filtrados = this.habitaciones;
    if (this.disponibleSeleccionado) {
      const disponible = this.disponibleSeleccionado === 'true';
      filtrados = filtrados.filter(h => h.disponible === disponible);
    }
    if (this.hotelSeleccionado) {
      const hotelId = Number(this.hotelSeleccionado);
      filtrados = filtrados.filter(h => h.codigo_hotel === hotelId);
    }
    this.habitacionesFiltradas = filtrados;
  }

  //post 
openAddModal() {
    if (!this.isSuperAdmin) return;
    this.newModel = {
      num: '',
      caracteristicas: '',
      precio: 0,
      codigo_hotel: 0,
      disponible: true,
      fecha_creacion: '',
      cant_huespedes: 1
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

  saveAdd(form: any) {
 if (!form.valid || !this.isSuperAdmin) return;
    
    if (!this.newModel.num || !this.newModel.caracteristicas || !this.newModel.precio || !this.newModel.codigo_hotel || !this.newModel.disponible || !this.newModel.fecha_creacion ||!this.newModel.cant_huespedes) {
      alert('Completa todos los campos obligatorios ');
      return;
    }
    
    this.savingAdd = true;

    const today = new Date();
    const formattedDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const payload: Partial<Habitacion> = {
      ...this.newModel,
      fecha_creacion: formattedDate
    };

    this.habitacionService.agregarHabitacion(payload).subscribe({
      next: (habitacionAgregada) => {
        this.habitaciones.unshift(habitacionAgregada);
        this.aplicarFiltros();
        this.savingAdd = false;
        this.closeAddModal();
        alert(' agregado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.savingAdd = false;
        console.error('Error al agregar:', err);

        if (err.error && err.error.nombre) {
          alert(`Error: ${err.error.nombre[0]}`);
        } else if (err.error && err.error.num) {
           alert(`Error: ${err.error.num[0]}`);
        } else {
          alert(`Error al agregar habitación. Por favor, revisa los datos.`);
        }
      }
    });
  }

  openEditModal(habitacion: Habitacion) {
    if (!this.isSuperAdmin) return;
    this._editTargetRef = habitacion;
    this.editModel = {
      num: habitacion.num,
      caracteristicas: habitacion.caracteristicas ?? '',
      precio: habitacion.precio ?? '',
      codigo_hotel: habitacion.codigo_hotel ?? '',
      disponible: habitacion.disponible ?? '',
      fecha_creacion: habitacion.fecha_creacion ?? '',
      cant_huespedes: habitacion.cant_huespedes ?? ''
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
      num: this.editModel.num,
      caracteristicas: this.editModel.caracteristicas,
      precio: this.editModel.precio,
      codigo_hotel: this.editModel.codigo_hotel,
      disponible: this.editModel.disponible,
      fecha_creacion: this.editModel.fecha_creacion,
      cant_huespedes: this.editModel.cant_huespedes
    };
    this.habitacionService.actualizarHabitacion(this.editModel.num, cambios).subscribe({
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

  onEliminarHabitacion(habitacion: Habitacion) {
    if (!this.isSuperAdmin) return;
    if (confirm('¿Eliminar habitación?')) {
      this.habitacionService.eliminarHabitacion(Number(habitacion.num)).subscribe({
        next: () => {
          this.habitaciones = this.habitaciones.filter(h => h.num !== habitacion.num);
          this.aplicarFiltros();
          alert('Habitación eliminada');
        },
        error: err => alert('Error al eliminar habitación')
      });
    }
  }
}