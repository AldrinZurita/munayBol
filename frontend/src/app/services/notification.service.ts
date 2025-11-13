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
      catchError((err) => {
        console.error('[NotificationService] Error en fetchNotifications:', err);
        this.notifications.next([]);
        return of([]);
      })
    );
  }

  getNotifications(): Observable<Notification[]> {
    this.fetchNotifications().subscribe();
    return this.notifications$;
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<{ unread: number }>('/api/notifications/unread_count/', this.authOptions()).pipe(
      map(r => r.unread),
      catchError((err) => {
        console.error('[NotificationService] Error en getUnreadCount:', err);
        return of(0);
      })
    );
  }

  markAsRead(notificationId: number): Observable<any> {
    return this.http.post(`/api/notifications/${notificationId}/mark_as_read/`, {}, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe()),
      catchError((err) => {
        console.error('[NotificationService] Error en markAsRead:', err);
        return of(null);
      })
    );
  }

  markAllAsRead(): Observable<any> {
    return this.http.post('/api/notifications/mark_all_as_read/', {}, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe()),
      catchError((err) => {
        console.error('[NotificationService] Error en markAllAsRead:', err);
        return of(null);
      })
    );
  }

  deleteNotification(notificationId: number): Observable<any> {
    return this.http.delete(`/api/notifications/${notificationId}/delete_notification/`, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe()),
      catchError(() => of(null))
    );
  }

  connectSocket(): void {
    if (typeof window === 'undefined' || this.ws) return;
    const token = this.auth.getToken();
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}/ws/notifications/?token=${encodeURIComponent(token)}`;
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.fetchNotifications().subscribe();
      };
      this.ws.onmessage = () => {
        this.fetchNotifications().subscribe();
      };
      this.ws.onclose = () => {
        this.ws = undefined;
      };
      this.ws.onerror = (e) => {
        console.warn('WebSocket error (not critical):', e);
      };
    } catch (e) {
      console.warn('WebSocket connection error (not critical):', e);
    }
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
