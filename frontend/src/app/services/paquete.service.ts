import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Paquete } from '../interfaces/paquete.interface';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PaqueteService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthOptions(): { headers?: HttpHeaders } {
  const token = this.authService.getToken();
  console.log('Token enviado en petición:', token);
  return token
    ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    : {};
}


  getPaquetes(): Observable<Paquete[]> {
    return this.http.get<Paquete[]>(`${this.apiUrl}paquetes/`);
    // ← sin token porque debe ser público
  }

  crearPaquete(paquete: Partial<Paquete>): Observable<Paquete> {
    return this.http.post<Paquete>(`${this.apiUrl}paquetes/`, paquete, this.getAuthOptions());
  }

  actualizarPaquete(paquete: Paquete): Observable<Paquete> {
    return this.http.put<Paquete>(`${this.apiUrl}paquetes/${paquete.id_paquete}/`, paquete, this.getAuthOptions());
  }

  eliminarPaquete(id_paquete: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}paquetes/${id_paquete}/`, this.getAuthOptions());
  }

  getPaqueteById(id: number): Observable<Paquete> {
    return this.http.get<Paquete>(`${this.apiUrl}paquetes/${id}/`);
    // ← también puede ser público si el backend lo permite
  }
}
