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

export type ActualizarLugarDTO = Partial<Pick<
  Habitacion,
  'num' | 'caracteristicas' | 'precio' | 'codigo_hotel' | 'disponible' | 'fecha_creacion' | 'cant_huespedes'
>>;

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private readonly apiUrl = environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}habitaciones/`;
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
    const { num, ...rest } = habitacion;
    return this.http.post<Habitacion>(`${this.baseUrl}`, rest, this.getAuthOptions());
  }

  actualizarHabitacion(habitacionNum: string | number, data: ActualizarLugarDTO): Observable<Habitacion> {
    const id = String(habitacionNum);
    return this.http.put<Habitacion>(`${this.baseUrl}${id}/`, data, this.getAuthOptions());
  }

  eliminarHabitacion(id_habitacion: number | string): Observable<any> {
    const id = String(id_habitacion);
    return this.http.delete<any>(`${this.baseUrl}${id}/` ,this.getAuthOptions());
  }

  getHabitacionesPorHotel(codigo_hotel: number): Observable<Habitacion[]> {
    return this.http.get<Habitacion[]>(`${this.apiUrl}habitaciones/?codigo_hotel=${codigo_hotel}`);
  }

  getHabitacionByNum(num: string | number): Observable<Habitacion> {
    return this.http.get<Habitacion>(`${this.baseUrl}${String(num)}/`);
  }

  getDisponibilidadHabitacion(num: string | number, desde?: string, hasta?: string): Observable<DisponibilidadHabitacionResponse> {
    const params: string[] = [];
    if (desde) params.push(`desde=${desde}`);
    if (hasta) params.push(`hasta=${hasta}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<DisponibilidadHabitacionResponse>(`${this.baseUrl}${String(num)}/disponibilidad/${qs}`);
  }
}
