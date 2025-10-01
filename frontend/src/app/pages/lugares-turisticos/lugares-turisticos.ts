import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';

@Component({
  selector: 'app-lugares-turisticos',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule],
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

  private readonly baseUrl = '/api/lugares';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargando = true;

    this.http.get<LugarTuristico[]>(this.baseUrl).subscribe({
      next: (rows) => {
        this.lugares = rows;

        const allCities = this.lugares
          .map(l => String(l.departamento ?? '').trim())
          .filter(s => s.length > 0);

        this.ciudades = Array.from(new Set(allCities))
          .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

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
      const ciudad = this.ciudadSeleccionada.trim().toLowerCase();
      filtrados = filtrados.filter(l =>
        String(l.departamento ?? '').trim().toLowerCase() === ciudad
      );
    }

    this.lugaresFiltrados = filtrados;
  }
}
