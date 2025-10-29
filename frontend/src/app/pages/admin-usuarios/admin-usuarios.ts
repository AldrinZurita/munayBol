import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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
  
  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsuarios();
  }

  get totalAdmins(): number {
    return this.usuarios.filter(u => u.rol === 'superadmin').length;
  }

  get totalActive(): number {
    return this.usuarios.filter(u => u.estado).length;
  }

  loadUsuarios() {
    this.loading = true;
    const token = localStorage.getItem('token');
    
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<Usuario[]>('http://localhost:8000/api/usuarios/', { headers })
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

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.patch<Usuario>(
      `http://localhost:8000/api/usuarios/${usuario.id}/`,
      { rol: newRole },
      { headers }
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
        alert('Error al actualizar el rol');
      }
    });
  }

  toggleUserStatus(usuario: Usuario) {
    if (!confirm(`¿Estás seguro de ${usuario.estado ? 'desactivar' : 'activar'} a ${usuario.nombre}?`)) {
      return;
    }

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.patch<Usuario>(
      `http://localhost:8000/api/usuarios/${usuario.id}/`,
      { estado: !usuario.estado },
      { headers }
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
        alert('Error al actualizar el estado');
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
}
