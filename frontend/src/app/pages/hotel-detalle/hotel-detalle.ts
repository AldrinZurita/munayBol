import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Hotel } from '../../interfaces/hotel.interface';
import { HotelService } from '../../services/hotel.service';
import { HabitacionService } from '../../services/habitacion.service';
import { Habitacion } from '../../interfaces/habitacion.interface';

@Component({
  selector: 'app-hotel-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hotel-detalle.html',
  styleUrls: ['./hotel-detalle.scss'],
})
export class HotelDetalleComponent implements OnInit {
  hotel: Hotel | null = null;
  habitaciones: Habitacion[] = [];
  cargando = false;
  cargandoHabitaciones = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private hotelService: HotelService,
    private habitacionService: HabitacionService,
  ) { }

  ngOnInit(): void {
    this.cargando = true;
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error = 'ID de hotel no válido.';
      this.cargando = false;
      return;
    }
    this.hotelService.getHotelById(id).subscribe({
      next: (hotel) => {
        this.hotel = hotel;
        this.cargando = false;
        this.getHabitaciones();
      },
      error: (e) => {
        this.error = 'No se pudo cargar el hotel.';
        this.cargando = false;
      }
    });
    
    

  }


  
  getHabitaciones(): void {
    if (!this.hotel || !this.hotel.id_hotel) {
      this.error = 'No se ha seleccionado un hotel válido';
      return;
    }

    this.cargandoHabitaciones = true;
    this.habitacionService.getHabitacionesPorHotel(this.hotel.id_hotel).subscribe({
    next: (habitaciones: Habitacion[]) => {
      this.habitaciones = habitaciones;
      this.cargandoHabitaciones = false;
    },
    error: (err) => {
      console.error('Error al obtener habitaciones:', err);
      this.error = 'No se pudo cargar la lista de habitaciones';
      this.cargandoHabitaciones = false;
    }
  });

  }

}