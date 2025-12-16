import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { LugarTuristico } from '../interfaces/lugar-turistico.interface';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export type CrearLugarDTO = Pick<
  LugarTuristico,
  'nombre' | 'ubicacion' | 'departamento' | 'tipo' | 'horario' | 'descripcion' | 'url_image_lugar_turistico'
>;

export type ActualizarLugarDTO = Partial<Pick<
  LugarTuristico,
  'nombre' | 'ubicacion' | 'departamento' | 'tipo' | 'horario' | 'descripcion' | 'url_image_lugar_turistico'
>>;

@Injectable({ providedIn: 'root' })
export class LugaresService {
  private readonly baseUrl = `${environment.apiUrl}/lugares/`;

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

  getLugares(): Observable<LugarTuristico[]> {
    return this.http.get<LugarTuristico[]>(this.baseUrl);
  }

  getLugarByIdLocal(id: number): Observable<LugarTuristico | null> {
    return this.getLugares().pipe(
      map(rows => rows.find(r => Number(r.id_lugar) === Number(id)) ?? null)
    );
  }

  getLugarById(id: number): Observable<LugarTuristico> {
    return this.http.get<LugarTuristico>(`${this.baseUrl}${id}/`);
  }

  agregarLugar(lugar: Partial<LugarTuristico>): Observable<LugarTuristico> {
    return this.http.post<LugarTuristico>(this.baseUrl, lugar, this.getAuthOptions());
  }

  actualizarLugar(lugar: LugarTuristico): Observable<LugarTuristico> {
    return this.http.put<LugarTuristico>(`${this.baseUrl}${lugar.id_lugar}/`, lugar, this.getAuthOptions());
  }

  eliminarLugar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${id}/`, this.getAuthOptions());
  }
}
