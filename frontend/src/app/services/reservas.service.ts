import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  private userCi = '1'; // TODO: reemplazar por servicio de auth

  constructor(private http: HttpClient) {}

  private buildHeaders(): HttpHeaders {
    return new HttpHeaders({ 'X-User-CI': this.userCi });
  }

  getReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.apiUrl, { headers: this.buildHeaders() });
  }
  
  getReservaById(id: number): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.apiUrl}${id}/`, { headers: this.buildHeaders() });
  }
  
  crearReserva(reserva: Partial<Reserva>): Observable<Reserva> {
    // Asegurar que el cuerpo incluye ci_usuario coherente
    if (!reserva.ci_usuario) {
      reserva.ci_usuario = Number(this.userCi);
    }
    return this.http.post<Reserva>(this.apiUrl, reserva, { headers: this.buildHeaders() });
  }
}
