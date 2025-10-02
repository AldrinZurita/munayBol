// src/app/services/paquete.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Paquete } from '../interfaces/paquete.interface';

@Injectable({
    providedIn: 'root'
})
export class PaqueteService {

    private apiUrl = 'http://localhost:8000/api/paquete/nuevo-paquete'; // Ajusta según tu backend

    constructor(private http: HttpClient) { }

    crearPaquete(paquete: Paquete): Observable<Paquete> {
        return this.http.post<Paquete>(this.apiUrl, paquete);
    }

    getPaquetes(): Observable<Paquete[]> {
        return this.http.get<Paquete[]>(this.apiUrl);
    }
}
