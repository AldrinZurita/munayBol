import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Hotel } from '../interfaces/hotel.interface';

@Injectable({
  providedIn: 'root'
})
export class HotelService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHoteles(): Observable<Hotel[]> {
    return this.http.get<Hotel[]>(`${this.apiUrl}hoteles/`);
  }

  getHotelById(id: number): Observable<Hotel> {
    return this.http.get<Hotel>(`${this.apiUrl}hoteles/${id}/`);
  }
}
