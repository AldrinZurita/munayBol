import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../services/admin-auth.service';
import { PaqueteService } from '../../services/paquete.service';
import { Paquete } from '../../interfaces/paquete.interface';

@Component({
  selector: 'app-paquetes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  isSuperAdmin = false;

  // Modal edición
  mostrarModalEditar = false;
  paqueteEditando: Paquete | null = null;

  inclusionesTexto = '';
  infoImportanteTexto = '';
  itinerarioTexto = '';

  constructor(private authService: AdminAuthService, private paqueteService: PaqueteService) {}

  ngOnInit() {
    this.isSuperAdmin = this.authService.isLoggedIn();
    this.cargarPaquetes();
  }

  cargarPaquetes() {
    this.cargando = true;
    this.paqueteService.getPaquetes().subscribe({
      next: (data) => {
        this.paquetes = data;
        this.paquetesFiltrados = [...this.paquetes];
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar paquetes', err);
        this.error = 'Error al cargar los paquetes.';
        this.cargando = false;
      }
    });
  }

  aplicarFiltros() {
    let filtrados = this.paquetes;

    if (this.disponibleSeleccionado) {
      const disponible = this.disponibleSeleccionado === 'true';
      filtrados = filtrados.filter(p => p.estado === disponible);
    }

    if (this.departamentoSeleccionado) {
      filtrados = filtrados.filter(p => p.lugar.departamento === this.departamentoSeleccionado);
    }

    if (this.tipoSeleccionado) {
      filtrados = filtrados.filter(p => p.tipo.toLowerCase() === this.tipoSeleccionado.toLowerCase());
    }

    this.paquetesFiltrados = filtrados;
  }

  onEditarPaquete(paquete: Paquete) {
    this.paqueteEditando = { ...paquete };
    this.mostrarModalEditar = true;
  }

  cerrarModal() {
    this.mostrarModalEditar = false;
    this.paqueteEditando = null;
  }
}
