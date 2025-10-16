import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../../../services/notification.service';
import { Notification } from '../../../interfaces/notification.interface';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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

  constructor(private notificationService: NotificationService) {
    this.notifications$ = this.notificationService.getNotifications();
    this.unreadCount$ = this.notificationService.getUnreadCount();
  }

  ngOnInit(): void {}

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  markAsRead(notificationId: number): void {
    this.notificationService.markAsRead(notificationId);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }
}
