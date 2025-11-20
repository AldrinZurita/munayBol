import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HotelService } from '../../services/hotel.service';
import { AuthService } from '../../services/auth.service';
import { Hotel } from '../../interfaces/hotel.interface';
import { ActivatedRoute, Router } from '@angular/router';
import { IconsModule } from '../../icons';
import { LoadingService } from '../../shared/services/loading';

@Component({
  selector: 'app-hoteles',
  standalone: true,
  imports: [CommonModule, FormsModule, IconsModule],
  templateUrl: './hoteles.html',
  styleUrls: ['./hoteles.scss']
})
export class Hoteles implements OnInit, AfterViewInit, OnDestroy {
  hoteles: Hotel[] = [];
  hotelesFiltrados: Hotel[] = [];

  ciudades: string[] = [];
  ciudadSeleccionada = '';
  calificacionSeleccionada = '';
  searchTerm = '';
  error = '';
  showModal = false;
  isEditMode = false;
  savingModal = false;
  modalHotelModel: Partial<Hotel> = {};
  private _editTarget: Hotel | null = null;
  private io?: IntersectionObserver;

  // --- Estados para modal de eliminación ---
showDeleteModal = false;
hotelAEliminar: Hotel | null = null;
confirmacionTexto = '';
errorEliminar = false;
eliminandoHotel = false;
mensajeEliminacion = '';

  constructor(
    private hotelService: HotelService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private loadingService: LoadingService
  ) {}

  ngOnInit() {
    this.loadingService.show('Cargando hoteles...');
    this.hotelService.getHoteles().subscribe({
      next: (hoteles) => {
        this.hoteles = hoteles;
        const allCities = this.hoteles
          .map(h => String(h.departamento ?? '').trim())
          .filter(s => s.length > 0);
        this.ciudades = Array.from(new Set(allCities))
          .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        this.hotelesFiltrados = [...this.hoteles];
        this.loadingService.hide();
        this.route.queryParams.subscribe(params => {
          this.ciudadSeleccionada = params['departamento'] ?? '';
          this.aplicarFiltros();
        });
        setTimeout(() => this.observeRevealTargets(), 0);
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de hoteles';
        this.loadingService.hide();
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupRevealObserver();
  }

  ngOnDestroy(): void {
    if (this.io) this.io.disconnect();
    this.loadingService.hide();
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperadmin();
  }

  aplicarFiltros() {
    const term = (this.searchTerm || '').trim().toLowerCase();
    let filtrados = this.hoteles.filter(h => {
      const okCiudad = this.ciudadSeleccionada ? String(h.departamento ?? '').trim() === this.ciudadSeleccionada : true;
      if (!okCiudad) return false;
      if (!term) return true;
      const nombre = (h.nombre ?? '').toLowerCase();
      const ubic = (h.ubicacion ?? '').toLowerCase();
      return nombre.includes(term) || ubic.includes(term);
    });

    if (this.calificacionSeleccionada !== '') {
      const calif = Number(this.calificacionSeleccionada);
      if (!Number.isNaN(calif)) {
        filtrados = filtrados.filter(h => Math.round(h.calificacion) === Math.round(calif));
      }
    }

    this.hotelesFiltrados = filtrados;
    setTimeout(() => this.observeRevealTargets(), 0);
  }

  clearFilters(): void {
    this.ciudadSeleccionada = '';
    this.calificacionSeleccionada = '';
    this.searchTerm = '';
    this.aplicarFiltros();
  }

  onVerDetalles(id_hotel: number) {
    this.router.navigate(['/hoteles', id_hotel]);
  }

  onEliminarHotel(hotel: Hotel): void {
  if (!this.isSuperAdmin) return;
  this.hotelAEliminar = hotel;
  this.confirmacionTexto = '';
  this.errorEliminar = false;
  this.mensajeEliminacion = '';
  this.eliminandoHotel = false;
  this.showDeleteModal = true;
  document.body.classList.add('no-scroll');
}

cancelarEliminacionHotel(): void {
  this.showDeleteModal = false;
  this.hotelAEliminar = null;
  this.confirmacionTexto = '';
  this.errorEliminar = false;
  this.mensajeEliminacion = '';
  this.eliminandoHotel = false;
  document.body.classList.remove('no-scroll');
}

confirmarEliminacionHotel(): void {
  if (this.confirmacionTexto !== 'ELIMINAR' || !this.hotelAEliminar) {
    this.errorEliminar = true;
    return;
  }

  this.errorEliminar = false;
  this.eliminandoHotel = true;
  this.mensajeEliminacion = '';

  this.hotelService.eliminarHotel(this.hotelAEliminar.id_hotel).subscribe({
    next: () => {
      this.hoteles = this.hoteles.filter(h => h.id_hotel !== this.hotelAEliminar!.id_hotel);
      this.aplicarFiltros();
      this.eliminandoHotel = false;
      this.mensajeEliminacion = ' Hotel eliminado correctamente';
    },
    error: () => {
      this.eliminandoHotel = false;
      this.errorEliminar = true;
      this.mensajeEliminacion = ' Error al eliminar hotel';
    }
  });
}

  openAddHotelModal(): void {
    if (!this.isSuperAdmin) return;
    this._editTarget = null;
    this.modalHotelModel = this.createEmptyHotel();
    this.isEditMode = false;
    this.openModal();
  }

  openEditHotelModal(hotel: Hotel): void {
    if (!this.isSuperAdmin) return;
    this._editTarget = hotel;
    this.modalHotelModel = { ...hotel };
    this.isEditMode = true;
    this.openModal();
  }

  saveNewHotel(form: NgForm): void {
    if (!form.valid || !this.isSuperAdmin) return;

    const today = new Date();
    const fecha =
      today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const payload: Partial<Hotel> = {
      ...this.modalHotelModel,
      fecha_creacion: fecha
    };

    this.savingModal = true;
    this.hotelService.agregarHotel(payload).subscribe({
      next: (hotel) => {
        this.hoteles.unshift(hotel as Hotel);
        this.aplicarFiltros();
        this.savingModal = false;
        this.closeHotelModal();
        alert('Hotel agregado correctamente');
      },
      error: (err) => {
        console.error('Error al agregar hotel:', err);
        this.savingModal = false;
        alert('Error al agregar hotel');
      }
    });
  }

  saveEditHotel(form: NgForm): void {
    if (!form.valid || !this._editTarget || !this.isSuperAdmin) return;
    this.savingModal = true;

    const payload: Hotel = {
      ...(this.modalHotelModel as Hotel),
      id_hotel: this._editTarget.id_hotel
    };

    this.hotelService.actualizarHotel(payload).subscribe({
      next: (h) => {
        Object.assign(this._editTarget!, h);
        this.aplicarFiltros();
        this.savingModal = false;
        this.closeHotelModal();
        alert('Hotel actualizado');
        this._editTarget = null;
      },
      error: (err) => {
        console.error('Error al actualizar hotel:', err);
        this.savingModal = false;
        alert('Error al actualizar hotel');
      }
    });
  }

  closeHotelModal(): void {
    if (this.savingModal) return;
    this.showModal = false;
    document.body.classList.remove('no-scroll');
  }

  private openModal(): void {
    this.showModal = true;
    document.body.classList.add('no-scroll');
  }

  private createEmptyHotel(): Partial<Hotel> {
    return {
      id_hotel: undefined as any,
      nombre: '',
      departamento: '',
      ubicacion: '',
      calificacion: undefined as any,
      estado: true,
      url_imagen_hotel: ''
    };
  }

  onModalImageError(evt: Event): void {
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

  toStarScore10to5(score10: number): number {
    const s = Math.max(0, Math.min(10, Number(score10) || 0));
    return Math.round((s / 2) * 2) / 2;
  }

  getStarIcons(score10: number): ('full'|'half'|'empty')[] {
    const score5 = this.toStarScore10to5(score10);
    const full = Math.floor(score5);
    const half = score5 - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return [
      ...Array(full).fill('full'),
      ...Array(half).fill('half'),
      ...Array(empty).fill('empty'),
    ];
  }

  formatFiveScale(score10: number): string {
    return `${this.toStarScore10to5(score10).toFixed(1)}/5`;
  }

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
  }

  private observeRevealTargets(): void {
    if (!this.io) return;
    document.querySelectorAll<HTMLElement>('.reveal').forEach(n => {
      if (!n.classList.contains('in-view')) this.io!.observe(n);
    });
  }

  trackByHotel(_: number, item: Hotel): number {
    return item.id_hotel;
  }
}
