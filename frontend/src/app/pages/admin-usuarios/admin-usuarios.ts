import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: 'superadmin' | 'usuario';
  pais: string;
  pasaporte: string;
  estado: boolean;
  fecha_creacion: string;
  avatar_url?: string;
}

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadingComponent],
  templateUrl: './admin-usuarios.html',
  styleUrls: ['./admin-usuarios.scss']
})
export class AdminUsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  loading = false;
  searchTerm = '';
  filterRole: string = 'all';
  filterStatus: string = 'all';

  private baseUrl = environment.apiUrl;
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    private auth: AuthService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    // Evitar llamada protegida en SSR: sin localStorage => sin Authorization => 401
    if (this.isBrowser) {
      this.loadUsuarios();
    }
  }

  get totalAdmins(): number {
    return this.usuarios.filter(u => u.rol === 'superadmin').length;
  }

  get totalActive(): number {
    return this.usuarios.filter(u => u.estado).length;
  }

  loadUsuarios() {
    this.loading = true;

    // Adjunta Authorization explícitamente con AuthService
    this.http.get<Usuario[]>(`${this.baseUrl}usuarios/`, this.authOptions())
      .subscribe({
        next: (data) => {
          this.usuarios = data;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.loading = false;
          if (error.status === 401 || error.status === 403) {
            alert('No tienes permisos para acceder a esta página');
            this.router.navigate(['/']);
          }
        }
      });
  }

  get filteredUsuarios(): Usuario[] {
    return this.usuarios.filter(u => {
      const matchesSearch = !this.searchTerm ||
        u.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        u.correo.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesRole = this.filterRole === 'all' || u.rol === this.filterRole;
      const matchesStatus = this.filterStatus === 'all' ||
        (this.filterStatus === 'active' && u.estado) ||
        (this.filterStatus === 'inactive' && !u.estado);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  changeUserRole(usuario: Usuario, newRole: 'superadmin' | 'usuario') {
    if (!confirm(`¿Estás seguro de cambiar el rol de ${usuario.nombre} a ${newRole}?`)) {
      return;
    }

    this.http.patch<Usuario>(
      `${this.baseUrl}usuarios/${usuario.id}/`,
      { rol: newRole },
      this.authOptions()
    ).subscribe({
      next: (updated) => {
        const index = this.usuarios.findIndex(u => u.id === usuario.id);
        if (index !== -1) {
          this.usuarios[index] = updated;
        }
        alert('Rol actualizado exitosamente');
      },
      error: (error) => {
        console.error('Error updating role:', error);
        alert(error?.error?.error || 'Error al actualizar el rol');
      }
    });
  }

  toggleUserStatus(usuario: Usuario) {
    const action = usuario.estado ? 'desactivar' : 'activar';
    if (!confirm(`¿Estás seguro de ${action} a ${usuario.nombre}?`)) {
      return;
    }

    this.http.patch<Usuario>(
      `${this.baseUrl}usuarios/${usuario.id}/`,
      { estado: !usuario.estado },
      this.authOptions()
    ).subscribe({
      next: (updated) => {
        const index = this.usuarios.findIndex(u => u.id === usuario.id);
        if (index !== -1) {
          this.usuarios[index] = updated;
        }
        alert('Estado actualizado exitosamente');
      },
      error: (error) => {
        console.error('Error updating status:', error);
        alert(error?.error?.error || 'Error al actualizar el estado');
      }
    });
  }

  viewUserProfile(usuario: Usuario) {
    this.router.navigate(['/perfil', usuario.id]);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getRoleBadgeClass(role: string): string {
    return role === 'superadmin' ? 'badge-admin' : 'badge-user';
  }

  getStatusBadgeClass(status: boolean): string {
    return status ? 'badge-active' : 'badge-inactive';
  }

  // Usa el helper del AuthService para adjuntar Authorization
  private authOptions() {
    return this.auth['authOptions']();
  }
}
