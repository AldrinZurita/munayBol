import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Hotel } from '../../interfaces/hotel.interface';
import { HotelService } from '../../services/hotel.service';

@Component({
  selector: 'app-hotel-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hotel-detalle.html',
  styleUrls: ['./hotel-detalle.scss'],
})
export class HotelDetalleComponent implements OnInit {
  hotel: Hotel | null = null;
  cargando = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private hotelService: HotelService
  ) {}

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
      },
      error: (e) => {
        this.error = 'No se pudo cargar el hotel.';
        this.cargando = false;
      }
    });
  }
}