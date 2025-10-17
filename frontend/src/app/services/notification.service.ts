import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Notification } from '../interfaces/notification.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notifications = new BehaviorSubject<Notification[]>([]);
  readonly notifications$ = this.notifications.asObservable();
  private ws?: WebSocket;

  constructor(private readonly http: HttpClient, private readonly auth: AuthService) {
    // React to auth state changes
    this.auth.user$.subscribe(user => {
      if (user) {
        this.connectSocket();
      } else {
        this.disconnectSocket();
        this.notifications.next([]);
      }
    });
  }

  private authOptions() {
    const token = this.auth.getToken();
    return token ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) } : {};
  }

  // Fetch list from backend and normalize dates
  fetchNotifications(): Observable<Notification[]> {
  return this.http.get<any[]>('/api/notifications/', this.authOptions()).pipe(
      map(list => list.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: new Date(n.created_at),
        link: n.link,
      }) as Notification)),
      tap(list => this.notifications.next(list)),
      catchError(() => {
        this.notifications.next([]);
        return of([]);
      })
    );
  }

  getNotifications(): Observable<Notification[]> {
    // Ensure we have latest list, but also return stream for subscribers
    this.fetchNotifications().subscribe();
    return this.notifications$;
  }

  getUnreadCount(): Observable<number> {
  return this.http.get<{ unread: number }>('/api/notifications/unread_count/', this.authOptions()).pipe(
      map(r => r.unread),
      catchError(() => of(0))
    );
  }

  markAsRead(notificationId: number): Observable<any> {
  return this.http.post(`/api/notifications/${notificationId}/mark_as_read/`, {}, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe()),
      catchError(() => of(null))
    );
  }

  markAllAsRead(): Observable<any> {
  return this.http.post('/api/notifications/mark_all_as_read/', {}, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe()),
      catchError(() => of(null))
    );
  }

  deleteNotification(notificationId: number): Observable<any> {
    return this.http.delete(`/api/notifications/${notificationId}/delete_notification/`, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe()),
      catchError(() => of(null))
    );
  }

  // WebSocket connection for real-time updates
  connectSocket(): void {
    // Avoid SSR and duplicate connections
    if (typeof window === 'undefined' || this.ws) return;
    const token = this.auth.getToken();
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host; // Will be proxied to backend in dev if needed
    // If running via Angular dev server with proxy, use same host and path /ws/notifications/
    const url = `${proto}://${host}/ws/notifications/?token=${encodeURIComponent(token)}`;
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        // Al conectar, traer la lista actual para mostrar el punto rojo si corresponde
        this.fetchNotifications().subscribe();
      };
      this.ws.onmessage = () => {
        // On any event, refetch notifications
        this.fetchNotifications().subscribe();
      };
      this.ws.onclose = () => {
        this.ws = undefined;
      };
      this.ws.onerror = () => {
        // No-op; will rely on polling via UI
      };
    } catch {}
  }

  private disconnectSocket(): void {
    try {
      if (this.ws) {
        this.ws.close();
      }
    } catch {}
    this.ws = undefined;
  }
}
