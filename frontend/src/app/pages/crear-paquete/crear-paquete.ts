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
    id_hotel: undefined,
    id_lugar: undefined,
    estado: true
  };

  constructor(private paqueteService: PaqueteService) {}

  crearPaquete() {
    if (!this.paquete.nombre || !this.paquete.tipo || !this.paquete.precio || !this.paquete.id_lugar || !this.paquete.id_hotel) {
      alert('Completa todos los campos obligatorios.');
      return;
    }
    this.paqueteService.crearPaquete(this.paquete).subscribe({
      next: (response) => {
        console.log('Paquete creado:', response);
        alert('Paquete guardado correctamente');
        this.paquete = {
          nombre: '',
          tipo: '',
          precio: 0,
          id_hotel: undefined,
          id_lugar: undefined,
          estado: true
        };
      },
      error: (err) => {
        console.error('Error al crear paquete:', err);
        alert('Error al guardar el paquete');
      }
    });
  }
}