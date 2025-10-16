import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Notification } from '../interfaces/notification.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notifications = new BehaviorSubject<Notification[]>([]);
  readonly notifications$ = this.notifications.asObservable();

  constructor(private readonly http: HttpClient, private readonly auth: AuthService) {}

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
      tap(list => this.notifications.next(list))
    );
  }

  getNotifications(): Observable<Notification[]> {
    // Ensure we have latest list, but also return stream for subscribers
    this.fetchNotifications().subscribe();
    return this.notifications$;
  }

  getUnreadCount(): Observable<number> {
  return this.http.get<{ unread: number }>('/api/notifications/unread_count/', this.authOptions()).pipe(
      map(r => r.unread)
    );
  }

  markAsRead(notificationId: number): Observable<any> {
  return this.http.post(`/api/notifications/${notificationId}/mark_as_read/`, {}, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe())
    );
  }

  markAllAsRead(): Observable<any> {
  return this.http.post('/api/notifications/mark_all_as_read/', {}, this.authOptions()).pipe(
      tap(() => this.fetchNotifications().subscribe())
    );
  }
}
