import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Reserva } from '../interfaces/reserva.interface';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly apiUrl = `${environment.apiUrl}reservas/`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const user = this.authService.getUser();
    const userId = user ? user.id.toString() : '';
    
    let headers = new HttpHeaders({ 'X-User-CI': userId });
    const token = this.authService.getToken();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }
  
  getReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  // --- NEW METHOD: To fetch reservations for the logged-in user ---
  getMisReservas(): Observable<Reserva[]> {
    const currentUser = this.authService.getUser();
    if (!currentUser) {
      return new Observable(observer => observer.next([]));
    }
    return this.getReservasPorUsuario(currentUser.id);
  }
  
  // --- NEW METHOD: Asks the backend for reservations for a specific user ID ---
  getReservasPorUsuario(id_usuario: number): Observable<Reserva[]> {
    const url = `${this.apiUrl}?id_usuario=${id_usuario}`;
    return this.http.get<Reserva[]>(url, { headers: this.getHeaders() });
  }
  
  getReservaById(id: number): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.apiUrl}${id}/`, { headers: this.getHeaders() });
  }
  
  crearReserva(reserva: Partial<Reserva>): Observable<Reserva> {
    const payload = { ...reserva };
    delete (payload as any).id_usuario;

    return this.http.post<any>(this.apiUrl, payload, { headers: this.getHeaders() })
      .pipe(
        map((resp: any) => {
          if (resp && typeof resp === 'object') {
            if ('id_reserva' in resp) return resp as Reserva;
            if ('reserva' in resp) return resp.reserva as Reserva;
          }
          return resp as Reserva;
        })
      );
  }
}

