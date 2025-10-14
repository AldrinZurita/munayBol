import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PaqueteService } from '../../services/paquete.service';
import { Paquete } from '../../interfaces/paquete.interface';

@Component({
  selector: 'app-paquete-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './paquete-detalle.html',
  styleUrls: ['./paquete-detalle.scss']
})
export class PaqueteDetalle implements OnInit {
  paquete: Paquete | null = null;
  itinerario: string[] = [];
  infoImportante: string[] = [];
  error = '';
  cargando = true;

  constructor(
    private route: ActivatedRoute,
    private paqueteService: PaqueteService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error = 'ID de paquete no válido';
      this.cargando = false;
      return;
    }

    this.paqueteService.getPaqueteById(id).subscribe({
      next: (data) => {
        this.paquete = data;
        this.itinerario = (data as any).itinerario ?? [];
        this.infoImportante = (data as any).info_importante ?? [];
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'No se pudo cargar el paquete';
        this.cargando = false;
        console.error(err);
      }
    });
  }

  getPrecioFormateado(): string {
    return this.paquete ? `${this.paquete.precio.toFixed(2)} BOB` : '';
  }

  getDuracion(): string {
    return this.itinerario.length ? `${this.itinerario.length} días` : 'Duración no especificada';
  }

  getGrupo(): string {
    const info = this.infoImportante.find((i: string) =>
      i.toLowerCase().includes('grupo')
    );
    return info || 'Grupo estándar';
  }
}
