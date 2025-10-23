import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { PaqueteService } from '../../services/paquete.service';
import { Paquete } from '../../interfaces/paquete.interface';
import { Loading } from "../../loading/loading";

@Component({
  selector: 'app-paquetes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Loading],
  templateUrl: './paquetes.html',
  styleUrls: ['./paquetes.scss']
})
export class Paquetes implements OnInit {
  paquetes: Paquete[] = [];
  paquetesFiltrados: Paquete[] = [];
  disponibleSeleccionado = '';
  departamentoSeleccionado = '';
  tipoSeleccionado = '';
  departamentos: string[] = ['Cochabamba', 'Chuquisaca', 'Beni', 'Pando', 'Santa Cruz', 'Tarija', 'La Paz', 'Oruro'];
  cargando = false;
  error = '';

  mostrarModalEditar = false;
  mostrarModalCrear = false; // ✅ NUEVO: controla el modal de creación
  paqueteEditando: Paquete | null = null;

  paqueteNuevo: Partial<Paquete> = {
    nombre: '',
    tipo: '',
    precio: 0,
    id_hotel: undefined,
    id_lugar: undefined,
    estado: true
  };

  constructor(
    public authService: AuthService,
    private paqueteService: PaqueteService
  ) {}

  ngOnInit() {
    this.cargando = true;
    this.paqueteService.getPaquetes().subscribe({
      next: (data) => {
        this.paquetes = data ?? [];
        this.paquetesFiltrados = [...this.paquetes];
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de paquetes';
        this.cargando = false;
      }
    });
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperadmin();
  }

  aplicarFiltros() {
    let filtrados = this.paquetes;

    if (this.disponibleSeleccionado) {
      const disponible = this.disponibleSeleccionado === 'true';
      filtrados = filtrados.filter(p => p.estado === disponible);
    }

    if (this.departamentoSeleccionado) {
      filtrados = filtrados.filter(p =>
        p.hotel && p.hotel.departamento
          ? p.hotel.departamento === this.departamentoSeleccionado
          : false
      );
    }

    if (this.tipoSeleccionado) {
      filtrados = filtrados.filter(p => p.tipo === this.tipoSeleccionado);
    }

    this.paquetesFiltrados = filtrados;
  }

  crearPaquete() {
    if (!this.isSuperAdmin) return;

    if (!this.paqueteNuevo.nombre || !this.paqueteNuevo.tipo || !this.paqueteNuevo.precio || !this.paqueteNuevo.id_hotel || !this.paqueteNuevo.id_lugar) {
      alert('Completa todos los campos obligatorios.');
      return;
    }

    this.paqueteService.crearPaquete(this.paqueteNuevo).subscribe({
      next: (paquete) => {
        this.paquetes.push(paquete);
        this.aplicarFiltros();
        alert('Paquete agregado correctamente');
        this.paqueteNuevo = {
          nombre: '',
          tipo: '',
          precio: 0,
          id_hotel: undefined,
          id_lugar: undefined,
          estado: true
        };
        this.mostrarModalCrear = false; // ✅ Cierra el modal al guardar
      },
      error: () => alert('Error al agregar paquete')
    });
  }

  onEditarPaquete(paquete: Paquete) {
    if (!this.isSuperAdmin) return;
    this.paqueteEditando = { ...paquete };
    this.mostrarModalEditar = true;
  }

  cerrarModal() {
    this.mostrarModalEditar = false;
    this.paqueteEditando = null;
  }

  guardarEdicion() {
    if (!this.paqueteEditando || !this.isSuperAdmin) return;

    this.paqueteService.actualizarPaquete(this.paqueteEditando).subscribe({
      next: (actualizado) => {
        const idx = this.paquetes.findIndex(p => p.id_paquete === actualizado.id_paquete);
        if (idx !== -1) {
          this.paquetes[idx] = actualizado;
          this.aplicarFiltros();
        }
        this.cerrarModal();
        alert('Paquete actualizado correctamente');
      },
      error: () => alert('Error al actualizar el paquete')
    });
  }

  onEliminarPaquete(paquete: Paquete) {
    if (!this.isSuperAdmin) return;

    if (confirm('¿Eliminar paquete?')) {
      this.paqueteService.eliminarPaquete(paquete.id_paquete).subscribe({
        next: () => {
          this.paquetes = this.paquetes.filter(p => p.id_paquete !== paquete.id_paquete);
          this.aplicarFiltros();
          alert('Paquete eliminado');
        },
        error: () => alert('Error al eliminar paquete')
      });
    }
  }
}
