import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';
import { ReservasService } from '../../services/reservas.service';
import { Reserva } from '../../interfaces/reserva.interface';
import { RouterModule } from '@angular/router';
import { HotelService } from '../../services/hotel.service'; // 1. Import HotelService
import { forkJoin, of } from 'rxjs'; // 2. Import RxJS operators
import { map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.scss']
})
export class Perfil implements OnInit {
  usuario: Usuario | null = null;
  cargando = true;

  reservas: Reserva[] = [];
  cargandoReservas = true;
  errorReservas = '';

  constructor(
    private authService: AuthService,
    private reservasService: ReservasService,
    private hotelService: HotelService // 3. Inject HotelService
  ) {}

  ngOnInit(): void {
    this.usuario = this.authService.getUser();
    this.cargando = false;

    if (this.usuario) {
      // --- NEW LOGIC to fetch reservations and then their hotels ---
      this.reservasService.getMisReservas().pipe(
        switchMap(reservas => {
          if (reservas.length === 0) {
            return of([]); // If no reservations, return an empty array
          }

          // 4. Get all unique hotel IDs from the reservations
          const hotelIds = [...new Set(reservas.map(r => r.codigo_hotel))];
          
          // 5. Create an array of API calls to fetch each hotel
          const hotelRequests = hotelIds.map(id => this.hotelService.getHotelById(id));
          
          // 6. Use forkJoin to run all hotel requests in parallel
          return forkJoin(hotelRequests).pipe(
            map(hoteles => {
              // 7. Create a lookup map for easy access to hotel names
              const hotelMap = new Map(hoteles.map(h => [h.id_hotel, h]));
              
              // 8. Attach the full hotel object to each reservation
              return reservas.map(reserva => ({
                ...reserva,
                hotel: hotelMap.get(reserva.codigo_hotel)
              }));
            })
          );
        })
      ).subscribe({
        next: (reservasConHotel) => {
          this.reservas = reservasConHotel;
          this.cargandoReservas = false;
        },
        error: () => {
          this.errorReservas = 'No se pudieron cargar tus reservas.';
          this.cargandoReservas = false;
        }
      });
    } else {
      this.cargandoReservas = false;
    }
  }
}

