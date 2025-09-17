import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HotelService } from '../../services/hotel';
import { Hotel } from '../../interfaces/hotel.interface';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-hoteles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hoteles.html',
  styleUrls: ['./hoteles.scss']
})
export class Hoteles implements OnInit {
  hoteles: Hotel[] = [];
  hotelesFiltrados: Hotel[] = [];
  ciudades: string[] = [];
  ciudadSeleccionada = '';
  calificacionSeleccionada = '';
  cargando = false;
  error = '';

  constructor(private hotelService: HotelService) {}

  ngOnInit() {
    this.cargando = true;
    this.hotelService.getHoteles().subscribe({
      next: hoteles => {
        this.hoteles = hoteles;
        this.ciudades = [
          ...new Set(hoteles.map(h => h.departamento.trim()))
        ];
        this.hotelesFiltrados = [...hoteles];
        this.cargando = false;
      },
      error: err => {
        this.error = 'No se pudo cargar la lista de hoteles';
        this.cargando = false;
      }
    });
  }

  aplicarFiltros() {
    let filtrados = this.hoteles;

    // Filtrar por ciudad/departamento
    if (this.ciudadSeleccionada) {
      const ciudad = this.ciudadSeleccionada.trim().toLowerCase();
      filtrados = filtrados.filter(h =>
        h.departamento.trim().toLowerCase() === ciudad
      );
    }

    // Filtrar por calificación
    if (this.calificacionSeleccionada) {
      const calif = parseFloat(this.calificacionSeleccionada);
      filtrados = filtrados.filter(h =>
        Math.round(h.calificacion) === Math.round(calif)
      );
    }

    this.hotelesFiltrados = filtrados;
  }

  onVerDetalles(id_hotel: number) {
    window.location.href = `/hoteles/${id_hotel}`;
  }
}