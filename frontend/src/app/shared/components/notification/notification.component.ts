import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../../../services/notification.service';
import { Notification } from '../../../interfaces/notification.interface';
import { Observable, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class NotificationComponent implements OnInit {
  showNotifications = false;
  notifications$: Observable<Notification[]>;
  unreadCount$: Observable<number>;

  constructor(private notificationService: NotificationService, private readonly auth: AuthService) {
    // Observa cambios de sesión; si hay usuario, pide el contador; si no, 0
    this.unreadCount$ = this.auth.user$.pipe(
      switchMap(user => user ? this.notificationService.getUnreadCount() : of(0))
    );
    // No dispares fetch aquí para evitar 401 antes de login; usa stream del servicio
    this.notifications$ = this.notificationService.notifications$;
  }

  ngOnInit(): void {}

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      // Al abrir, refresca la lista desde el backend (ya enviará token)
      this.notificationService.fetchNotifications().subscribe();
    }
  }

  markAsRead(notificationId: number): void {
    this.notificationService.markAsRead(notificationId).subscribe();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }
  onDeleteNotification(notificationId: number): void {
    this.notificationService.deleteNotification(notificationId).subscribe();
  }
}
