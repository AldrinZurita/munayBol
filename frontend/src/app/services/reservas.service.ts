import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Reserva } from '../interfaces/reserva.interface'; // Ensure you have this interface file

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private apiUrl = '/api/reservas/';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // --- FIX: A single, unified function to build all necessary headers dynamically ---
  private getHeaders(): HttpHeaders {
    const user = this.authService.getUser();
    const userId = user ? user.id.toString() : ''; // Get the real user ID
    
    let headers = new HttpHeaders({ 'X-User-CI': userId });
    const token = this.authService.getToken();

    if (token) {
      // HttpHeaders are immutable, so we must re-assign the variable
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }
  
  getReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.apiUrl, { headers: this.getHeaders() });
  }
  
  getReservaById(id: number): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.apiUrl}${id}/`, { headers: this.getHeaders() });
  }
  
  crearReserva(reserva: Partial<Reserva>): Observable<Reserva> {
    // --- FIX: Dynamically get the user ID if it's not already set ---
    if (!reserva.id_usuario) {
      const user = this.authService.getUser();
      if (user) {
        reserva.id_usuario = user.id;
      }
    }
    
    return this.http.post<Reserva>(this.apiUrl, reserva, { headers: this.getHeaders() });
  }
}

