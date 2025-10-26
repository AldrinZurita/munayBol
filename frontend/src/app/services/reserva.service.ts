import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Reserva } from '../interfaces/reserva.interface';

export interface CrearReservaDTO {
  fecha_reserva: string;       // YYYY-MM-DD
  fecha_caducidad: string;     // YYYY-MM-DD
  num_habitacion: number | string;
  codigo_hotel: number;
  id_pago: number;
  id_paquete?: number | null;
}

export interface ReservaResponse {
  message: string;
  reserva: any;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}reservas/`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  // Si tienes interceptor JWT, esto no es estrictamente necesario.
  private getAuthOptions(): { headers?: HttpHeaders } {
    const token = this.authService.getToken();
    return token ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) } : {};
  }

  // Lista las reservas del usuario autenticado (el backend ya filtra por usuario)
  getMisReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.baseUrl, this.getAuthOptions());
  }

  // Detalle de una reserva propia
  getReservaById(id: number): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.baseUrl}${id}/`, this.getAuthOptions());
  }

  // Crear una reserva (requiere autenticación)
  crearReserva(data: CrearReservaDTO): Observable<ReservaResponse> {
    return this.http.post<ReservaResponse>(this.baseUrl, data, this.getAuthOptions());
  }
}

// Compatibilidad: si en algún lugar inyectas ReservaService, seguirá funcionando
export { ReservasService as ReservaService };
