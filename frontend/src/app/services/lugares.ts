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
}
