import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Habitacion } from '../interfaces/habitacion.interface';

@Injectable({
  providedIn: 'root'
})
export class HabitacionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHabitaciones(): Observable<Habitacion[]> {
    return this.http.get<Habitacion[]>(`${this.apiUrl}habitaciones/`);
  }

  getHabitacionesPorHotel(codigo_hotel: number): Observable<Habitacion[]> {
    const params = new HttpParams().set('codigo_hotel', codigo_hotel);
    return this.http.get<Habitacion[]>(`${this.apiUrl}habitaciones/`, { params });
  }
}