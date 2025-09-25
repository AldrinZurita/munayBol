import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Reserva {
  id_reserva: number;
  fecha_reserva: string;
  fecha_caducidad: string;
  num_habitacion: string;
  codigo_hotel: number;
  fecha_creacion: string;
  ci_usuario: number;
  id_pago: number;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private apiUrl = '/api/reservas/';

  constructor(private http: HttpClient) {}

  getReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.apiUrl);
  }
  crearReserva(reserva: Partial<Reserva>): Observable<Reserva> {
    return this.http.post<Reserva>(this.apiUrl, reserva);
  }
}
