import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { Reserva } from '../interfaces/reserva.interface'; // Ensure you have this interface file
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly apiUrl = `${environment.apiUrl}reservas/`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
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
    // Backend asigna id_usuario desde el token; no es necesario enviarlo
    const payload = { ...reserva };
    delete (payload as any).id_usuario;

    return this.http.post<any>(this.apiUrl, payload, { headers: this.getHeaders() })
      .pipe(
        map((resp: any) => {
          // Aceptar tanto respuesta directa de Reserva como envoltura { message, reserva }
          if (resp && typeof resp === 'object') {
            if ('id_reserva' in resp) return resp as Reserva;
            if ('reserva' in resp) return resp.reserva as Reserva;
          }
          return resp as Reserva;
        })
      );
  }
}

