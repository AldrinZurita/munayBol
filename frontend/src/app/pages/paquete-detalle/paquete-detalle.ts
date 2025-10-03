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
  error = '';

  constructor(private route: ActivatedRoute, private paqueteService: PaqueteService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.paqueteService.getPaqueteById(+id).subscribe({
        next: (data) => this.paquete = data,
        error: () => this.error = 'Paquete no encontrado'
      });
    }
  }

  getPrecioFormateado(): string {
    return this.paquete ? `${this.paquete.precio.toFixed(2)} BOB` : '';
  }

  getDuracion(): string {
    return this.paquete ? 'Duración no especificada' : '';
  }
}
