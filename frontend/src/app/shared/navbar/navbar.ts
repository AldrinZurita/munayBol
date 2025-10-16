import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';

import { NotificationComponent } from '../components/notification/notification.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationComponent], 
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss']
})
export class NavbarComponent {
  isLoggedIn = false;
  username = '';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.user$.subscribe((user: Usuario | null) => {
      this.isLoggedIn = !!user;
      this.username = user ? user.nombre : '';
    });
  }

  logout() {
    this.authService.logout();
  }
}