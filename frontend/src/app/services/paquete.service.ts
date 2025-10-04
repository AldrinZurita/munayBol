import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Paquete } from '../interfaces/paquete.interface';

@Injectable({ providedIn: 'root' })
export class PaqueteService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPaquetes(): Observable<Paquete[]> {
    return this.http.get<Paquete[]>(`${this.apiUrl}paquetes/`);
  }

  crearPaquete(paquete: Partial<Paquete>): Observable<Paquete> {
    return this.http.post<Paquete>(`${this.apiUrl}paquetes/`, paquete);
  }

  actualizarPaquete(paquete: Paquete): Observable<Paquete> {
    return this.http.put<Paquete>(`${this.apiUrl}paquetes/${paquete.id_paquete}/`, paquete);
  }

  eliminarPaquete(id_paquete: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}paquetes/${id_paquete}/`);
  }

  getPaqueteById(id: number): Observable<Paquete> {
    return this.http.get<Paquete>(`${this.apiUrl}paquetes/${id}/`);
  }
}