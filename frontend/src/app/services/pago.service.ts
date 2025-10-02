import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private apiUrl = '/api/pagos/';

  constructor(private http: HttpClient) {}

  crearPago(pago: Pago): Observable<Pago> {
    return this.http.post<Pago>(this.apiUrl, pago);
  }

  getPagoById(id: number): Observable<Pago> {
    return this.http.get<Pago>(`${this.apiUrl}${id}/`);
  }
}
