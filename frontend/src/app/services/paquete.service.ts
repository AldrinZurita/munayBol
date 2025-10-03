import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Paquete } from '../interfaces/paquete.interface';

@Injectable({
    providedIn: 'root'
})
export class PaqueteService {
    private apiUrl = 'http://localhost:8000/api/paquetes'; // Ajusta según tus rutas backend

    constructor(private http: HttpClient) {}

    // Obtener todos los paquetes
    getPaquetes(): Observable<Paquete[]> {
        return this.http.get<Paquete[]>(this.apiUrl);
    }

    // Crear un paquete (solo se envían IDs de hotel y lugar)
    crearPaquete(paquete: Partial<Paquete>): Observable<Paquete> {
        return this.http.post<Paquete>(`${this.apiUrl}/`, paquete);
    }

    // Obtener un paquete por ID
    getPaqueteById(id: number): Observable<Paquete> {
        return this.http.get<Paquete>(`${this.apiUrl}/${id}/`);
    }
}
