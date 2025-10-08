import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ActualizarLugarDTO, HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

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

  onAgregarHabitacion() {
    if (!this.isSuperAdmin) return;
    const num = prompt('Número de habitación:')?.trim();
    const codigo_hotel = Number(prompt('Código hotel:'));
    const caracteristicas = prompt('Características:');
    const precio = Number(prompt('Precio:'));
    const cant_huespedes = Number(prompt('Cantidad máxima de huéspedes:'));
    const disponible = confirm('¿Disponible?');
    if (num && !isNaN(codigo_hotel) && caracteristicas && !isNaN(precio) && !isNaN(cant_huespedes)) {
      const nuevaHabitacion: Partial<Habitacion> = {
        num,
        codigo_hotel,
        caracteristicas,
        precio,
        cant_huespedes,
        disponible
      };
      this.habitacionService.agregarHabitacion(nuevaHabitacion).subscribe({
        next: habitacion => {
          this.habitaciones.push(habitacion);
          this.aplicarFiltros();
          alert('Habitación agregada correctamente');
        },
        error: err => alert('Error al agregar habitación')
      });
    }
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