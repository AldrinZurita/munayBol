import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], // <- AGREGA ESTO
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  correo = '';
  contrasenia = '';
  error = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  login() {
    this.loading = true;
    this.error = '';
    this.auth.login({ correo: this.correo, contrasenia: this.contrasenia }).subscribe({
      next: resp => {
        if (resp.usuario && resp.usuario.estado) {
          this.snackBar.open('¡Inicio de sesión exitoso!', '', { duration: 2500 });
          // Redirige por rol
          if (resp.usuario.rol === 'superadmin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/']);
          }
        } else {
          this.error = 'Usuario inactivo o no autorizado.';
          this.auth.logout();
        }
        this.loading = false;
      },
      error: err => {
        this.error = 'Credenciales inválidas o usuario no autorizado.';
        this.snackBar.open(this.error, '', { duration: 2500 });
        this.loading = false;
      }
    });
  }
}