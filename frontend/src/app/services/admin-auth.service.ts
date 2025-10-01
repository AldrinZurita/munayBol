import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Usuario } from '../interfaces/usuario.interface';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private baseUrl = environment.apiUrl;
  private adminUserSubject: BehaviorSubject<Usuario | null>;
  public adminUser$: Observable<Usuario | null>;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    let savedUser: Usuario | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const userJson = localStorage.getItem('adminUser');
      savedUser = userJson ? JSON.parse(userJson) : null;
    }
    this.adminUserSubject = new BehaviorSubject<Usuario | null>(savedUser);
    this.adminUser$ = this.adminUserSubject.asObservable();
  }

  login(data: { correo: string; contrasenia: string }): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.baseUrl}superadmin/login/`, data).pipe(
      tap(user => {
        if (user && user.rol === 'superadmin' && user.estado && isPlatformBrowser(this.platformId)) {
          localStorage.setItem('adminUser', JSON.stringify(user));
          this.adminUserSubject.next(user);
        }
      })
    );
  }

  logout() {
    this.adminUserSubject.next(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('adminUser');
    }
  }

  isLoggedIn(): boolean {
    const user = this.adminUserSubject.value;
    return !!user && user.rol === 'superadmin' && user.estado;
  }

  getUser(): Usuario | null {
    return this.adminUserSubject.value;
  }

  getUserName(): string {
    const user = this.getUser();
    return user ? user.nombre : '';
  }
}