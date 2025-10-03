import { Component } from '@angular/core';
import { PaqueteService } from '../../services/paquete.service';
import { Paquete } from '../../interfaces/paquete.interface';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'crear-paquete',
  templateUrl: './crear-paquete.html',
  styleUrls: ['./crear-paquete.scss'],
  imports: [FormsModule]
})
export class CrearPaquete {
  paquete: Partial<Paquete> = {
    nombre: '',
    tipo: '',
    precio: 0,
    estado: true,
    id_hotel: 0,
    id_lugar: 0,
    fecha_creacion: new Date().toISOString().split('T')[0]
  };

  constructor(private paqueteService: PaqueteService) {}

  crearPaquete() {
    this.paqueteService.crearPaquete(this.paquete).subscribe({
      next: (response) => {
        console.log('Paquete creado:', response);
        alert('Paquete guardado correctamente ✅');
      },
      error: (err) => {
        console.error('Error al crear paquete:', err);
        alert('Error al guardar el paquete');
      }
    });
  }
}
