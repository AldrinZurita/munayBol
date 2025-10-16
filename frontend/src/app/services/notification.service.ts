import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from '../interfaces/notification.interface';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notifications.asObservable();

  private mockNotifications: Notification[] = [
    {
      id: 1,
      title: 'Reserva Confirmada',
      message: 'Tu reserva para el Hotel "El Dorado" ha sido confirmada.',
      read: false,
      createdAt: new Date(),
      link: '/mis-reservas'
    },
    {
      id: 2,
      title: 'Nuevo Paquete Turístico',
      message: '¡Descubre el Salar de Uyuni con nuestro nuevo paquete!',
      read: true,
      createdAt: new Date(Date.now() - 86400000), // 1 day ago
      link: '/paquetes'
    },
    {
      id: 3,
      title: 'Oferta Especial',
      message: '20% de descuento en tu próximo viaje a Cochabamba.',
      read: false,
      createdAt: new Date(Date.now() - 172800000), // 2 days ago
    }
  ];

  constructor() {
    // Simulate fetching notifications
    this.notifications.next(this.mockNotifications);
  }

  getNotifications(): Observable<Notification[]> {
    return this.notifications$;
  }

  markAsRead(notificationId: number): void {
    const updatedNotifications = this.notifications.getValue().map(n => {
      if (n.id === notificationId) {
        return { ...n, read: true };
      }
      return n;
    });
    this.notifications.next(updatedNotifications);
  }

  markAllAsRead(): void {
    const updatedNotifications = this.notifications.getValue().map(n => ({ ...n, read: true }));
    this.notifications.next(updatedNotifications);
  }

  getUnreadCount(): Observable<number> {
    return new Observable(subscriber => {
      this.notifications$.subscribe(notifications => {
        subscriber.next(notifications.filter(n => !n.read).length);
      });
    });
  }
}
