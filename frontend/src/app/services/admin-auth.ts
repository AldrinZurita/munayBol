import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { AdminLoginData } from '../interfaces/admin-login.interface';
import { Usuario } from '../interfaces/usuario.interface';

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private apiUrl = environment.apiUrl;
  private adminUserSubject = new BehaviorSubject<Usuario | null>(null);
  adminUser$ = this.adminUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Solo lee localStorage si es navegador
    if (isPlatformBrowser(this.platformId)) {
      const user = localStorage.getItem('adminUser');
      if (user) {
        this.adminUserSubject.next(JSON.parse(user));
      }
    }
  }

  login(data: AdminLoginData): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}auth/login/`, data).pipe(
      tap(user => {
        this.adminUserSubject.next(user);
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('adminUser', JSON.stringify(user));
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