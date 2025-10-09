import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.scss']
})
export class Perfil implements OnInit {
  usuario: Usuario | null = null;
  cargando = true;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Retrieve the user data from the authentication service
    this.usuario = this.authService.getUser();
    this.cargando = false;
  }
}
