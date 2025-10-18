import { Component } from '@angular/core';
import { NotificationService } from '../../../services/notification.service';
import { Notification } from '../../../interfaces/notification.interface';
import { Observable, of, switchMap, map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class NotificationComponent {
  private mouseOver = false;

  onMouseEnter(): void {
    this.mouseOver = true;
    if (!this.showNotifications) {
      this.showNotifications = true;
      this.notificationService.fetchNotifications().subscribe();
    }
  }

  onMouseLeave(): void {
    this.mouseOver = false;
    if (this.showNotifications) {
      this.showNotifications = false;
    }
  }
  showNotifications = false;
  notifications$: Observable<Notification[]>;
  unreadCount$: Observable<number>;

  constructor(
    private notificationService: NotificationService,
    private readonly auth: AuthService,
    private router: Router
  ) {
    // Stream principal de notificaciones
    this.notifications$ = this.notificationService.notifications$;
    // Derivar contador de no leídas del stream para reaccionar a WS y actualizaciones locales
    this.unreadCount$ = this.notifications$.pipe(
      map(list => list.filter(n => !n.read).length)
    );
    // Cuando el usuario inicie sesión, conectar socket y traer lista inicial
    this.auth.user$.pipe(switchMap(u => u ? this.notificationService.fetchNotifications() : of([]))).subscribe();
  }


  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      // Al abrir, refresca la lista desde el backend (ya enviará token)
      this.notificationService.fetchNotifications().subscribe();
    }
  }

  onNotificationClick(notification: Notification): void {
    this.notificationService.markAsRead(notification.id).subscribe();
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }
  onDeleteNotification(notificationId: number): void {
    this.notificationService.deleteNotification(notificationId).subscribe();
  }
}
