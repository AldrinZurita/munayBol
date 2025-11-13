import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service'; // 1. Import AuthService
import { environment} from '../../environments/environment';

export interface Pago {
  id_pago?: number;
  tipo_pago: string;
  monto: number;
  fecha?: string;
  fecha_creacion?: string;
  estado?: string;
  cod_seguridad?: string;
}

@Injectable({ providedIn: 'root' })
export class PagoService {
  private apiUrl = `${environment.apiUrl}pagos/`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    const token = this.authService.getToken();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  crearPago(pago: Pago): Observable<Pago> {
    return this.http.post<Pago>(this.apiUrl, pago, { headers: this.getHeaders() });
  }

  getPagoById(id: number): Observable<Pago> {
    return this.http.get<Pago>(`${this.apiUrl}${id}/`, { headers: this.getHeaders() });
  }
}
