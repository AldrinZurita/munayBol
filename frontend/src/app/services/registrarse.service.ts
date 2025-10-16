import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RegistrarseService {
  private apiUrl = 'http://localhost:8000/api/'; // 🔥 URL fija al backend

  constructor(private http: HttpClient) {}

  registrarUsuario(datos: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(`${this.apiUrl}usuarios/registro/`, datos, { headers });
  }
}
