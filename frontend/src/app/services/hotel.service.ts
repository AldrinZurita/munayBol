import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Hotel } from '../interfaces/hotel.interface';

@Injectable({ providedIn: 'root' })
export class HotelService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHoteles(): Observable<Hotel[]> {
    return this.http.get<Hotel[]>(`${this.apiUrl}hoteles/`);
  }

  agregarHotel(hotel: Partial<Hotel>): Observable<Hotel> {
    return this.http.post<Hotel>(`${this.apiUrl}hoteles/`, hotel);
  }

  actualizarHotel(hotel: Hotel): Observable<Hotel> {
    return this.http.put<Hotel>(`${this.apiUrl}hoteles/${hotel.id_hotel}/`, hotel);
  }

  eliminarHotel(id_hotel: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}hoteles/${id_hotel}/`);
  }

  getHotelById(id: number): Observable<Hotel> {
    return this.http.get<Hotel>(`${this.apiUrl}hoteles/${id}/`);
  }
}
