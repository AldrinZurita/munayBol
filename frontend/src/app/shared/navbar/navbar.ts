import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
export class NavbarComponent implements OnInit {
  isLoggedIn = false;
  username = '';
  user: Usuario | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user: Usuario | null) => {
      this.user = user;
      this.isLoggedIn = !!user;
      this.username = user ? (user.nombre || user.correo) : '';
    });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/']);
  }
}
