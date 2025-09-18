import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Habitacion } from '../interfaces/habitacion.interface';

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

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
  
}