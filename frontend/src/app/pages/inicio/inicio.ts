import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Hotel } from '../../interfaces/hotel.interface';
import { HotelService } from '../../services/hotel';
import { flush } from '@angular/core/testing';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss'
})
export class Inicio implements OnInit {
  hoteles: Hotel[] = [];
  departamentoSeleccionado = '';
  ordenCalificacion: 'asc' | 'desc' = 'asc';
  cargando = false;
  error = '';

  constructor(private hotelService: HotelService){}

  ngOnInit() {
    this.cargando = true;
    this.hotelService.getHoteles().subscribe({
      next: hoteles => {
        this.hoteles = hoteles;
        this.cargando = false;
      },
      error: err => {
        this.error = 'No se pudo cargar la lista de hoteles';
        this.cargando = false;
      }
    });
  }

  get hotelesFiltrados(): Hotel[] {
  let filtrados = this.hoteles;

    if (this.departamentoSeleccionado) {
      const filtro = this.departamentoSeleccionado.trim().toLowerCase();
      filtrados = filtrados.filter(hotel =>
        hotel.departamento.trim().toLowerCase() === filtro
      );
    }

    filtrados = filtrados.sort((a, b) => {
      if (this.ordenCalificacion === 'asc') {
        return a.calificacion - b.calificacion;
      } else {
        return b.calificacion - a.calificacion;
      }
    });

    return filtrados;
  }

  onDepartamentoChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.departamentoSeleccionado = select.value;
  }

  onOrdenCalificacionChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.ordenCalificacion = select.value as 'asc' | 'desc';
  }
}
