import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Habitacion } from '../interfaces/habitacion.interface';

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

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getHabitaciones(): Observable<Habitacion[]> {
    return this.http.get<Habitacion[]>(`${this.apiUrl}habitaciones/`);
  }

  agregarHabitacion(habitacion: Partial<Habitacion>): Observable<Habitacion> {
    return this.http.post<Habitacion>(`${this.apiUrl}habitaciones/`, habitacion);
  }

  actualizarHabitacion(habitacion: Habitacion): Observable<Habitacion> {
    return this.http.put<Habitacion>(`${this.apiUrl}habitaciones/${habitacion.num}/`, habitacion);
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