import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { LugarTuristico } from '../interfaces/lugar-turistico.interface';

@Injectable({ providedIn: 'root' })
export class LugaresService {
  // Ajusta al endpoint real de tu backend
  private readonly baseUrl = '/api/lugares';

  constructor(private http: HttpClient) {}

  getLugares(): Observable<LugarTuristico[]> {
    return this.http.get<LugarTuristico[]>(this.baseUrl);
  }

  getLugarByIdLocal(id: number): Observable<LugarTuristico | null> {
    return this.getLugares().pipe(
      map(rows => rows.find(r => Number(r.id_lugar) === Number(id)) ?? null)
    );
  }

  getLugarById(id: number): Observable<LugarTuristico> {
    return this.http.get<LugarTuristico>(`${this.baseUrl}/${id}`);
  }

  // --- NUEVO: Método para agregar un lugar ---
  agregarLugar(lugar: Partial<LugarTuristico>): Observable<LugarTuristico> {
    return this.http.post<LugarTuristico>(this.baseUrl, lugar);
  }

  // --- NUEVO: Método para actualizar un lugar ---
  actualizarLugar(lugar: LugarTuristico): Observable<LugarTuristico> {
    // Se envía el ID en la URL para identificar el recurso a actualizar
    return this.http.put<LugarTuristico>(`${this.baseUrl}/${lugar.id_lugar}`, lugar);
  }

  // --- NUEVO: Método para eliminar un lugar ---
  eliminarLugar(id: number): Observable<any> {
    // Se envía el ID en la URL para identificar el recurso a eliminar
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
