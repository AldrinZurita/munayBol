import { Component, OnInit, AfterViewInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LugarTuristico } from '../../interfaces/lugar-turistico.interface';
import { AuthService } from '../../services/auth.service';
import { LugaresService } from '../../services/lugares.service';
import { IconsModule } from '../../icons';
import { PLATFORM_ID } from '@angular/core';
import { Subscription } from 'rxjs';

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
  tipos: string[] = [];

  ciudadSeleccionada = '';
  selectedTipo = '';
  searchTerm = '';

  cargando = false;
  error = '';

  routeLoading = false;
  private routerSub?: Subscription;
  private qpSub?: Subscription;

  showModal = false;
  isEditMode = false;
  savingModal = false;
  modalModel: Partial<LugarTuristico> = {};
  private _editTargetRef: LugarTuristico | null = null;

  private io: IntersectionObserver | null = null;
  private readonly isBrowser: boolean;

  constructor(
    private lugaresService: LugaresService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.cargarLugares();

    // Loader navegación
    this.routerSub = this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationStart) {
        this.routeLoading = true;
      } else if (evt instanceof NavigationEnd || evt instanceof NavigationCancel || evt instanceof NavigationError) {
        this.routeLoading = false;
      }
    });

    // Reaccionar a filtros desde el Navbar (query params)
    this.qpSub = this.route.queryParams.subscribe((qp) => {
      const d = (qp['departamento'] ?? '').toString();
      const t = (qp['tipo'] ?? '').toString();
      if (typeof d === 'string') this.ciudadSeleccionada = d;
      if (typeof t === 'string') this.selectedTipo = t;
      // No tocamos searchTerm desde la URL aquí
      this.aplicarFiltros();
    });
  }

  ngAfterViewInit(): void {
    this.setupRevealObserver();
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
    this.io = null;
    this.routerSub?.unsubscribe();
    this.qpSub?.unsubscribe();
    if (this.isBrowser) document.body.classList.remove('no-scroll');
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
      url_image_lugar_turistico: '',
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

        const allTipos = this.lugares
          .map((l) => (l?.tipo ?? '').toString().trim())
          .filter((s) => s.length > 0);
        this.tipos = Array.from(new Set(allTipos)).sort((a, b) => a.localeCompare(b));

        this.lugaresFiltrados = [...this.lugares];
        this.cargando = false;
        if (this.isBrowser) requestAnimationFrame(() => this.observeRevealTargets());
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de lugares.';
        this.cargando = false;
      },
    });
  }

  aplicarFiltros(): void {
    const term = this.normalize(this.searchTerm);
    const selDepto = this.normalize(this.ciudadSeleccionada);
    const selTipo = this.normalize(this.selectedTipo);

    this.lugaresFiltrados = this.lugares.filter((l) => {
      const okDepto = selDepto ? this.normalize(l.departamento) === selDepto : true;
      const okTipo = selTipo ? this.normalize(l.tipo) === selTipo : true;
      if (!okDepto || !okTipo) return false;

      if (!term) return true;
      const nombre = this.normalize(l.nombre ?? '');
      const tipo = this.normalize(l.tipo ?? '');
      const ubic = this.normalize(l.ubicacion ?? '');
      return nombre.includes(term) || tipo.includes(term) || ubic.includes(term);
    });

    if (this.isBrowser) requestAnimationFrame(() => this.observeRevealTargets());
  }

  clearFilters(): void {
    this.ciudadSeleccionada = '';
    this.selectedTipo = '';
    this.searchTerm = '';
    this.aplicarFiltros();
    // También limpiar query params
    void this.router.navigate([], { relativeTo: this.route, queryParams: { departamento: null, tipo: null }, queryParamsHandling: 'merge' });
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
        const msg = err?.error?.nombre?.[0] || err?.error?.id_lugar?.[0] || 'Error al agregar el lugar.';
        alert(msg);
      },
    });
  }

  closeModal(): void {
    if (this.savingModal) return;
    this.showModal = false;
    if (this.isBrowser) document.body.classList.remove('no-scroll');
  }

  private openModal(): void {
    this.showModal = true;
    if (this.isBrowser) document.body.classList.add('no-scroll');
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

  /* ===== Reveal on scroll (SSR-safe) ===== */
  ngOnChanges(): void {
    // no-op
  }

  private setupRevealObserver(): void {
    if (!this.isBrowser) {
      this.io = null;
      return;
    }
    const hasIO = typeof (window as any).IntersectionObserver !== 'undefined';
    if (!hasIO) {
      this.markAllRevealed();
      this.io = null;
      return;
    }
    this.io?.disconnect();
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
    if (!this.isBrowser) return;
    if (!this.io) {
      this.markAllRevealed();
      return;
    }
    document.querySelectorAll<HTMLElement>('.reveal').forEach((n) => {
      if (!n.classList.contains('in-view')) this.io!.observe(n);
    });
  }

  private markAllRevealed(): void {
    if (!this.isBrowser) return;
    document.querySelectorAll<HTMLElement>('.reveal').forEach((n) => n.classList.add('in-view'));
  }

  /* ===== Utils ===== */
  private normalize(s: string | undefined | null): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }
}
