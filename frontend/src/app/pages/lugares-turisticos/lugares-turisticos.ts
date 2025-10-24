import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';
import { AuthService } from '../../services/auth.service';
import { LugaresService } from '../../services/lugares.service';
import { IconsModule } from '../../icons';

@Component({
  selector: 'app-lugares-turisticos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconsModule],
  templateUrl: './lugares-turisticos.html',
  styleUrls: ['./lugares-turisticos.scss'],
})
export class LugaresTuristicos implements OnInit, AfterViewInit, OnDestroy {
  lugares: LugarTuristico[] = [];
  lugaresFiltrados: LugarTuristico[] = [];
  ciudades: string[] = [];
  ciudadSeleccionada = '';
  searchTerm = '';
  cargando = false;
  error = '';

  // Loader navegación
  routeLoading = false;
  private routerSub: any;

  // Modal (Agregar / Editar)
  showModal = false;
  isEditMode = false;
  savingModal = false;
  modalModel: Partial<LugarTuristico> = {};
  private _editTargetRef: LugarTuristico | null = null;

  // Reveal on scroll
  private io?: IntersectionObserver;

  constructor(
    private lugaresService: LugaresService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarLugares();

    // Loader de rutas
    this.routerSub = this.router.events.subscribe(evt => {
      if (evt instanceof NavigationStart) {
        this.routeLoading = true;
      } else if (evt instanceof NavigationEnd || evt instanceof NavigationCancel || evt instanceof NavigationError) {
        this.routeLoading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupRevealObserver();
  }

  ngOnDestroy(): void {
    if (this.io) this.io.disconnect();
    if (this.routerSub) this.routerSub.unsubscribe();
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperadmin();
  }

  private createEmptyLugar(): Partial<LugarTuristico> {
    return {
      id_lugar: undefined,
      nombre: '',
      ubicacion: '',
      departamento: '',
      tipo: '',
      horario: '',
      descripcion: '',
      url_image_lugar_turistico: ''
    };
  }

  cargarLugares(): void {
    this.cargando = true;
    this.error = '';
    this.lugaresService.getLugares().subscribe({
      next: (rows) => {
        this.lugares = rows ?? [];
        const allCities = this.lugares
          .map((l) => (l?.departamento ?? '').toString().trim())
          .filter((s) => s.length > 0);
        this.ciudades = Array.from(new Set(allCities)).sort((a, b) => a.localeCompare(b));
        this.lugaresFiltrados = [...this.lugares];
        this.cargando = false;
        setTimeout(() => this.observeRevealTargets(), 0);
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de lugares.';
        this.cargando = false;
      },
    });
  }

  aplicarFiltros(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.lugaresFiltrados = this.lugares.filter((l) => {
      const okDepto = this.ciudadSeleccionada ? l.departamento === this.ciudadSeleccionada : true;
      if (!okDepto) return false;
      if (!term) return true;
      const nombre = (l.nombre ?? '').toLowerCase();
      const tipo = (l.tipo ?? '').toLowerCase();
      const ubic = (l.ubicacion ?? '').toLowerCase();
      return nombre.includes(term) || tipo.includes(term) || ubic.includes(term);
    });
    setTimeout(() => this.observeRevealTargets(), 0);
  }

  clearFilters(): void {
    this.ciudadSeleccionada = '';
    this.searchTerm = '';
    this.aplicarFiltros();
  }

  // Navegar a detalles con loader
  goToDetalle(id: number): void {
    this.routeLoading = true;
    this.router.navigate(['/lugares-turisticos', id]).catch(() => {
      this.routeLoading = false;
    });
  }

  onEliminarLugar(lugar: LugarTuristico): void {
    if (!this.isSuperAdmin) return;
    const confirmado = confirm(`¿Eliminar el lugar "${lugar.nombre}"?`);
    if (!confirmado) return;

    this.lugaresService.eliminarLugar(lugar.id_lugar).subscribe({
      next: () => {
        this.lugares = this.lugares.filter((l) => l.id_lugar !== lugar.id_lugar);
        this.aplicarFiltros();
        alert('Lugar turístico eliminado correctamente.');
      },
      error: () => alert('Error al eliminar el lugar turístico.'),
    });
  }

  openEditModal(lugar: LugarTuristico): void {
    if (!this.isSuperAdmin) return;
    this._editTargetRef = lugar;
    this.modalModel = { ...lugar };
    this.isEditMode = true;
    this.openModal();
  }

  openAddModal(): void {
    if (!this.isSuperAdmin) return;
    this._editTargetRef = null;
    this.modalModel = this.createEmptyLugar();
    this.isEditMode = false;
    this.openModal();
  }

  saveEdit(form: NgForm): void {
    if (!form.valid || !this._editTargetRef || !this.isSuperAdmin) return;
    this.savingModal = true;

    const payload: LugarTuristico = {
      ...(this.modalModel as LugarTuristico),
      id_lugar: this._editTargetRef.id_lugar,
    };

    this.lugaresService.actualizarLugar(payload).subscribe({
      next: (resp) => {
        Object.assign(this._editTargetRef!, resp);
        this.aplicarFiltros();
        this.savingModal = false;
        this.closeModal();
        alert('Lugar turístico actualizado con éxito.');
        this._editTargetRef = null;
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al actualizar:', err?.error ?? err);
        alert(`Error al actualizar el lugar turístico: ${JSON.stringify(err?.error ?? err)}`);
        this.savingModal = false;
      },
    });
  }

  saveNewLugar(form: NgForm): void {
    if (!form.valid || !this.isSuperAdmin) return;

    const today = new Date();
    const formattedDate =
      today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const payload: Partial<LugarTuristico> = {
      ...this.modalModel,
      fecha_creacion: formattedDate,
    };

    this.savingModal = true;
    this.lugaresService.agregarLugar(payload).subscribe({
      next: (lugarAgregado) => {
        this.lugares.unshift(lugarAgregado);
        this.aplicarFiltros();
        this.savingModal = false;
        this.closeModal();
        alert('Lugar turístico agregado exitosamente.');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al agregar:', err);
        this.savingModal = false;
        const msg =
          err?.error?.nombre?.[0] ||
          err?.error?.id_lugar?.[0] ||
          'Error al agregar el lugar.';
        alert(msg);
      },
    });
  }

  closeModal(): void {
    if (this.savingModal) return;
    this.showModal = false;
    document.body.classList.remove('no-scroll');
  }

  private openModal(): void {
    this.showModal = true;
    document.body.classList.add('no-scroll'); // requiere body.no-scroll { overflow:hidden } en estilos globales o con ::ng-deep (incluido)
  }

  trackByLugar(_: number, item: LugarTuristico): number {
    return item.id_lugar;
  }

  onImageError(evt: Event): void {
    const img = evt.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
          <rect width="100%" height="100%" fill="#f1f5f9"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="14">Imagen no disponible</text>
        </svg>`
      );
  }

  /* ===== Reveal on scroll ===== */
  private setupRevealObserver(): void {
    if (this.io) this.io.disconnect();
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('in-view');
            this.io?.unobserve(e.target);
          }
        }
      },
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    );
    this.observeRevealTargets();
  }

  private observeRevealTargets(): void {
    if (!this.io) return;
    document.querySelectorAll<HTMLElement>('.reveal').forEach(n => {
      if (!n.classList.contains('in-view')) this.io!.observe(n);
    });
  }
}
