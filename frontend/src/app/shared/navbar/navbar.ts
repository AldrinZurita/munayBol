import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; // 1. Import Router
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule], 
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss']
})
export class NavbarComponent implements OnInit { // Re-added OnInit for best practice
  isLoggedIn = false;
  username = '';

  constructor(
    private authService: AuthService,
    private router: Router // 2. Inject Router
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe((user: Usuario | null) => {
      this.isLoggedIn = !!user;
      this.username = user ? user.nombre : '';
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']); // 3. Add redirection to homepage
  }
}

