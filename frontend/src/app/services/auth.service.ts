import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Usuario } from '../interfaces/usuario.interface';
import { isPlatformBrowser } from '@angular/common';

export interface LoginResponse {
  refresh: string;
  access: string;
  usuario: Usuario;
}

export interface GithubLoginUrlResponse {
  authorize_url: string;
  state: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = environment.apiUrl;
  private userSubject: BehaviorSubject<Usuario | null>;
  public user$: Observable<Usuario | null>;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    let savedUser: Usuario | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const userJson = localStorage.getItem('user');
      savedUser = userJson ? JSON.parse(userJson) : null;
    }
    this.userSubject = new BehaviorSubject<Usuario | null>(savedUser);
    this.user$ = this.userSubject.asObservable();
  }

  private authOptions(): { headers: HttpHeaders } {
    const token = this.getToken();
    return {
      headers: new HttpHeaders(
        token ? { Authorization: `Bearer ${token}` } : {}
      ),
    } as { headers: HttpHeaders };
  }

  login(data: { correo: string; contrasenia: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}usuarios/login/`, data).pipe(
      tap(resp => this.persist(resp))
    );
  }

  googleLogin(idToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}auth/google/`, { token: idToken }).pipe(
      tap(resp => this.persist(resp))
    );
  }

  githubLoginUrl(): Observable<GithubLoginUrlResponse> {
    return this.http.get<GithubLoginUrlResponse>(`${this.baseUrl}auth/github/login-url/`);
  }
  githubExchange(code: string, state: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}auth/github/exchange/`, { code, state }).pipe(
      tap(resp => this.persist(resp))
    );
  }

  getMe(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.baseUrl}usuarios/me/`, this.authOptions()).pipe(
      tap(user => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('user', JSON.stringify(user));
        }
        this.userSubject.next(user);
      })
    );
  }

  updateMe(data: Partial<Pick<Usuario, 'nombre' | 'pais' | 'pasaporte' | 'avatar_url'>>): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.baseUrl}usuarios/me/`, data, this.authOptions()).pipe(
      tap(user => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('user', JSON.stringify(user));
        }
        this.userSubject.next(user);
      })
    );
  }

  private persist(resp: LoginResponse) {
    if (resp && resp.usuario && resp.access && isPlatformBrowser(this.platformId)) {
      localStorage.setItem('user', JSON.stringify(resp.usuario));
      localStorage.setItem('token', resp.access);
      this.userSubject.next(resp.usuario);
    }
  }

  logout() {
    this.userSubject.next(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }

  isLoggedIn(): boolean {
    const user = this.userSubject.value;
    return !!user && user.estado;
  }

  getUser(): Usuario | null {
    return this.userSubject.value;
  }

  getUserName(): string {
    const user = this.getUser();
    return user ? user.nombre : '';
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  isSuperadmin(): boolean {
    const user = this.getUser();
    return !!user && user.rol === 'superadmin' && user.estado;
  }

  isUsuario(): boolean {
    const user = this.getUser();
    return !!user && user.rol === 'usuario' && user.estado;
  }
}
