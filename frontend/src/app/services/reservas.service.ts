import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Reserva } from '../interfaces/reserva.interface';
import { environment } from '../../environments/environment';

export interface AdminReservasParams {
  id_usuario?: number;
  estado?: 'true' | 'false';
  page?: number;
  page_size?: number;
}

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
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  getReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getMisReservas(): Observable<Reserva[]> {
    const currentUser = this.authService.getUser();
    if (!currentUser) return of<Reserva[]>([]);
    return this.getReservasPorUsuario(currentUser.id);
  }

  getReservasPorUsuario(id_usuario: number): Observable<Reserva[]> {
    const url = `${this.apiUrl}?id_usuario=${id_usuario}&estado=true`;
    return this.http.get<Reserva[]>(url, { headers: this.getHeaders() });
  }

  listReservasAdmin(params: AdminReservasParams = {}): Observable<Reserva[]> {
    let httpParams = new HttpParams();
    if (params.id_usuario != null) httpParams = httpParams.set('id_usuario', params.id_usuario);
    if (params.estado != null) httpParams = httpParams.set('estado', params.estado);
    if (params.page != null) httpParams = httpParams.set('page', params.page);
    if (params.page_size != null) httpParams = httpParams.set('page_size', params.page_size);
    return this.http.get<Reserva[]>(this.apiUrl, { headers: this.getHeaders(), params: httpParams });
  }

  getReservaById(id: number): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.apiUrl}${id}/`, { headers: this.getHeaders() });
  }

  crearReserva(reserva: Partial<Reserva>): Observable<Reserva> {
    const payload = { ...reserva };
    delete (payload as any).id_usuario;
    return this.http.post<any>(this.apiUrl, payload, { headers: this.getHeaders() }).pipe(
      map((resp: any) => {
        if (resp && typeof resp === 'object') {
          if ('id_reserva' in resp) return resp as Reserva;
          if ('reserva' in resp) return resp.reserva as Reserva;
        }
        return resp as Reserva;
      })
    );
  }

  actualizarReserva(id_reserva: number, patch: Partial<Reserva>): Observable<Reserva> {
    return this.http.patch<Reserva>(`${this.apiUrl}${id_reserva}/`, patch, { headers: this.getHeaders() });
  }

  cancelarReserva(id_reserva: number): Observable<{ message: string; id_reserva: number }> {
    return this.http.post<{ message: string; id_reserva: number }>(
      `${this.apiUrl}${id_reserva}/cancelar/`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(err => {
        if (err?.status === 404) {
          return this.http.delete<any>(`${this.apiUrl}${id_reserva}/`, { headers: this.getHeaders() }).pipe(
            map(() => ({ message: 'Reserva desactivada correctamente', id_reserva: id_reserva }))
          );
        }
        return throwError(() => err);
      })
    );
  }

  reactivarReserva(id_reserva: number): Observable<{ message: string; id_reserva: number }> {
    return this.http.post<{ message: string; id_reserva: number }>(
      `${this.apiUrl}${id_reserva}/reactivar/`,
      {},
      { headers: this.getHeaders() }
    );
  }
}
