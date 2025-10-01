import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../services/admin-auth.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar'; // <-- Importa el snackbar

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.scss']
})
export class AdminLogin {
  correo = '';
  contrasenia = '';
  error = '';
  loading = false;

  constructor(
    private auth: AdminAuthService,
    private router: Router,
    private snackBar: MatSnackBar // <-- Inyéctalo aquí
  ) {}

  login() {
    this.loading = true;
    this.error = '';
    this.auth.login({ correo: this.correo, contrasenia: this.contrasenia }).subscribe({
      next: user => {
        if (user.rol === 'superadmin' && user.estado) {
          // Notificación de éxito
          this.snackBar.open('¡Inicio de sesión exitoso!', '', { duration: 2500 });
          this.router.navigate(['/']); // Redirige a la página de inicio
        } else {
          this.error = 'Solo el superadministrador puede acceder.';
          this.auth.logout();
        }
        this.loading = false;
      },
      error: err => {
        this.error = 'Credenciales inválidas o usuario no autorizado.';
        this.snackBar.open(this.error, '', { duration: 2500 }); // Notificación de error
        this.loading = false;
      }
    });
  }
}