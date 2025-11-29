import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
// IMPORTANTE: Importamos desde el archivo base 'environment'
// Angular se encarga de cambiarlo por environment.prod.ts cuando subes a Render
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RegistrarseService {
  // CORRECCIÓN: Usamos la variable dinámica + la ruta '/api/'
  private apiUrl = `${environment.apiUrl}/api/`;

  constructor(private http: HttpClient) {}

  registrarUsuario(datos: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    // La URL final será:
    // Local:  http://localhost:8000/api/usuarios/registro/
    // Render: https://munaybol-backend.onrender.com/api/usuarios/registro/
    return this.http.post<any>(`${this.apiUrl}usuarios/registro/`, datos, { headers });
  }
}