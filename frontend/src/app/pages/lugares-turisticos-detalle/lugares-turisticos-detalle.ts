import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LugaresService } from '../../services/lugares';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';

@Component({
  selector: 'app-lugares-turisticos-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './lugares-turisticos-detalle.html',
  styleUrls: ['./lugares-turisticos-detalle.scss'],
})
export class LugaresTuristicosDetalle implements OnInit {
  lugar: LugarTuristico | null = null;
  cargando = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private lugaresService: LugaresService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error = 'Identificador de lugar inválido';
      this.cargando = false;
      return;
    }

    // --- Opción A: local (trae todos y filtra) ---
    this.lugaresService.getLugarByIdLocal(id).subscribe({
      next: (lugar) => {
        if (!lugar) {
          this.error = 'No se encontró el lugar solicitado';
        } else {
          this.lugar = lugar;
        }
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el lugar';
        this.cargando = false;
      }
    });

    // --- Opción B (ideal): si ya tienes /api/lugares/:id, usa esto en su lugar ---
    // this.lugaresService.getLugarById(id).subscribe({
    //   next: lugar => { this.lugar = lugar; this.cargando = false; },
    //   error: () => { this.error = 'No se pudo cargar el lugar'; this.cargando = false; }
    // });
  }
}
