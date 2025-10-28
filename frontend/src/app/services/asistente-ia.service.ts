import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatSession, MessagesPage } from '../interfaces/chat.interface';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AsistenteIaService {
  private baseUrl = environment.apiUrl;
  private sessionsUrl = `${this.baseUrl}chat/sessions/`;

  private currentSessionId: string | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  // Header Authorization explícito (fallback si falla el interceptor)
  private authHeaders(): { headers: HttpHeaders } {
    const token = this.auth.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
    return { headers };
  }

  // ============ Sesiones ============
  listSessions(params?: { q?: string; archived?: boolean }): Observable<ChatSession[]> {
    let httpParams = new HttpParams();
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (typeof params?.archived === 'boolean') httpParams = httpParams.set('archived', String(params.archived));
    return this.http.get<ChatSession[]>(this.sessionsUrl, { params: httpParams, ...this.authHeaders() });
  }

  createSession(payload?: { title?: string }): Observable<ChatSession> {
    return this.http.post<ChatSession>(this.sessionsUrl, payload || {}, this.authHeaders());
  }

  getSession(id: string): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.sessionsUrl}${id}/`, this.authHeaders());
  }

  patchSession(id: string, payload: Partial<Pick<ChatSession, 'title' | 'archived'>>): Observable<ChatSession> {
    return this.http.patch<ChatSession>(`${this.sessionsUrl}${id}/`, payload, this.authHeaders());
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete<void>(`${this.sessionsUrl}${id}/`, this.authHeaders());
  }

  // ============ Mensajes ============
  listMessages(id: string, opts?: { page?: number; limit?: number }): Observable<MessagesPage> {
    let params = new HttpParams();
    if (opts?.page) params = params.set('page', String(opts.page));
    if (opts?.limit) params = params.set('limit', String(opts.limit));
    return this.http.get<MessagesPage>(`${this.sessionsUrl}${id}/messages/`, { params, ...this.authHeaders() });
  }

  appendMessage(id: string, content: string): Observable<{ session: string; assistant: { role: 'assistant'; content: string } }> {
    return this.http.post<{ session: string; assistant: { role: 'assistant'; content: string } }>(
      `${this.sessionsUrl}${id}/messages/`,
      { role: 'user', content },
      this.authHeaders()
    );
  }

  // ============ Estado actual ============
  setCurrentSession(id: string | null) {
    this.currentSessionId = id;
  }

  getCurrentSession(): string | null {
    return this.currentSessionId;
  }

  // Compat: endpoint antiguo (no se usa para historial)
  enviarPrompt(prompt: string) {
    return this.http.post<{ result: string; chat_id?: string }>(`${this.baseUrl}llm/generate/`, { prompt }, this.authHeaders());
  }

  resetChat() {
    this.currentSessionId = null;
  }
}
