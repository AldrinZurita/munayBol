import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Hotel } from '../interfaces/hotel.interface';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class HotelService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthOptions(): { headers?: HttpHeaders } {
    const token = this.authService.getToken();
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  getHoteles(): Observable<Hotel[]> {
    return this.http.get<Hotel[]>(`${this.apiUrl}/hoteles/`);
  }

  agregarHotel(hotel: Partial<Hotel>): Observable<Hotel> {
    return this.http.post<Hotel>(`${this.apiUrl}/hoteles/`, hotel, this.getAuthOptions());
  }

  actualizarHotel(hotel: Hotel): Observable<Hotel> {
    return this.http.put<Hotel>(`${this.apiUrl}/hoteles/${hotel.id_hotel}/`, hotel, this.getAuthOptions());
  }

  eliminarHotel(id_hotel: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/hoteles/${id_hotel}/`, this.getAuthOptions());
  }

  getHotelById(id: number): Observable<Hotel> {
    return this.http.get<Hotel>(`${this.apiUrl}/hoteles/${id}/`);
  }
}
