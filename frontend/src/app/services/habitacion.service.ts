import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Habitacion } from '../interfaces/habitacion.interface';
import { AuthService } from './auth.service';

export interface IntervaloReservado {
  inicio: string;
  fin: string;
}

export interface DisponibilidadHabitacionResponse {
  habitacion: string;
  codigo_hotel: number;
  intervalos_reservados: IntervaloReservado[];
  next_available_from: string;
  ventana_consulta: { desde: string; hasta: string };
}

export type CrearHabitacionDTO = Pick<
  Habitacion,
  'num' | 'caracteristicas' | 'precio' | 'codigo_hotel' | 'disponible' | 'fecha_creacion' | 'cant_huespedes'
>;

// DTO para actualizar (enviamos solo los campos editables)
export type ActualizarLugarDTO = Partial<Pick<
  Habitacion,
  'num' | 'caracteristicas' | 'precio' | 'codigo_hotel' | 'disponible' | 'fecha_creacion' | 'cant_huespedes'
>>;

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = '/api/habitaciones/';

  constructor(private readonly http: HttpClient, private authService: AuthService) { }


  private getAuthOptions(): { headers?: HttpHeaders } {
    const token = this.authService.getToken();
    console.log('Token enviado en petición:', token);
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  getHabitaciones(): Observable<Habitacion[]> {
    return this.http.get<Habitacion[]>(`${this.apiUrl}habitaciones/`);
  }

  agregarHabitacion(habitacion: Partial<Habitacion>): Observable<Habitacion> {
    return this.http.post<Habitacion>(`${this.apiUrl}habitaciones/`, habitacion);
  }

  actualizarHabitacion(habitacion: string, data: ActualizarLugarDTO): Observable<Habitacion> {
    return this.http.put<Habitacion>(`${this.baseUrl}${habitacion}/`, data, this.getAuthOptions());
  }

  eliminarHabitacion(id_habitacion: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}habitaciones/${id_habitacion}/`);
  }

  getHabitacionesPorHotel(codigo_hotel: number): Observable<Habitacion[]> {
    return this.http.get<Habitacion[]>(`${this.apiUrl}habitaciones/?codigo_hotel=${codigo_hotel}`);
  }

  getHabitacionByNum(num: string): Observable<Habitacion> {
    return this.http.get<Habitacion>(`${this.apiUrl}habitaciones/${num}/`);
  }

  getDisponibilidadHabitacion(num: string, desde?: string, hasta?: string): Observable<DisponibilidadHabitacionResponse> {
    const params: string[] = [];
    if (desde) params.push(`desde=${desde}`);
    if (hasta) params.push(`hasta=${hasta}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<DisponibilidadHabitacionResponse>(`${this.apiUrl}habitaciones/${num}/disponibilidad/${qs}`);
  }

}