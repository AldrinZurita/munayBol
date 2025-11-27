import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PaqueteService } from '../../services/paquete.service';
import { Paquete } from '../../interfaces/paquete.interface';
import { IconsModule } from '../../icons';
import { LoadingService } from '../../shared/services/loading';
type MediaKind = 'lugar' | 'hotel';

@Component({
  selector: 'app-paquetes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconsModule],
  templateUrl: './paquetes.html',
  styleUrls: ['./paquetes.scss']
})
export class Paquetes implements OnInit, OnDestroy {
  paquetes: Paquete[] = [];
  paquetesFiltrados: Paquete[] = [];
  searchTerm = '';
  departamentos: string[] = [];
  departamentoSeleccionado = '';
  tipos: string[] = ['aventura', 'cultural', 'naturaleza', 'historico', 'gastronomico'];
  tipoSeleccionado = '';
  disponibleSeleccionado = '';
  error = '';
  showModal = false;
  isEditMode = false;
  savingModal = false;
  modalPaqueteModel: Partial<Paquete> = {};
  private _editTarget: Paquete | null = null;
  private activeMedia = new Map<number, MediaKind>();

  constructor(
    public authService: AuthService,
    private paqueteService: PaqueteService,
    private router: Router,
    private route: ActivatedRoute,
    private loadingService: LoadingService // <-- 2. INYECTADO
  ) {}

  ngOnInit(): void {
    this.loadingService.show('Cargando paquetes...');
    this.paqueteService.getPaquetes().subscribe({
      next: (data) => {
        this.paquetes = data ?? [];
        this.paquetesFiltrados = [...this.paquetes];
        const allDeps = this.paquetes
          .map(p => (p.hotel?.departamento || (p as any).lugar?.departamento || '').toString().trim())
          .filter(s => s.length > 0);
        this.departamentos = Array.from(new Set(allDeps))
          .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        for (const p of this.paquetes) {
          const hasLugar = Boolean(this.getLugarImage(p));
          const hasHotel = Boolean(this.getHotelImage(p));
          this.activeMedia.set(p.id_paquete, hasLugar ? 'lugar' : (hasHotel ? 'hotel' : 'lugar'));
        }
        this.loadingService.hide();
        this.route.queryParams.subscribe(params => {
          const rawDep = params['departamento'] ?? '';
          const found = this.departamentos.find(d => this.normalize(d) === this.normalize(rawDep));
          this.departamentoSeleccionado = found || rawDep;
          this.aplicarFiltros();
        });
      },
      error: () => {
        this.error = 'No se pudo cargar la lista de paquetes';
        this.loadingService.hide();
      }
    });
  }
  ngOnDestroy(): void {
    this.loadingService.hide();
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperadmin();
  }

  private normalize(s: string): string {
    return (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  aplicarFiltros(): void {
    const term = this.normalize(this.searchTerm);

    let filtrados = this.paquetes.filter(p => {
      const dep = p.hotel?.departamento || p.lugar?.departamento || '';
      const okDep = this.departamentoSeleccionado
        ? this.normalize(dep) === this.normalize(this.departamentoSeleccionado)
        : true;
      if (!okDep) return false;
      const okTipo = this.tipoSeleccionado ? p.tipo === this.tipoSeleccionado : true;
      if (!okTipo) return false;
      if (this.disponibleSeleccionado) {
        const disp = this.disponibleSeleccionado === 'true';
        if (p.estado !== disp) return false;
      }
      if (!term) return true;
      const nombre = this.normalize(p.nombre);
      const hotelNombre = this.normalize(p.hotel?.nombre || '');
      const lugarNombre = this.normalize(p.lugar?.nombre || '');
      const ubic = this.normalize(p.hotel?.ubicacion || '');
      return (
        nombre.includes(term) ||
        hotelNombre.includes(term) ||
        lugarNombre.includes(term) ||
        ubic.includes(term)
      );
    });

    this.paquetesFiltrados = filtrados;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.departamentoSeleccionado = '';
    this.tipoSeleccionado = '';
    this.disponibleSeleccionado = '';
    this.aplicarFiltros();
  }

  onVerDetalles(id_paquete: number): void {
    this.router.navigate(['/paquetes', id_paquete]);
  }






showDeleteModal = false;
paqueteAEliminar: Paquete | null = null;
confirmacionTexto = '';
errorEliminar = false;
eliminandoPaquete = false;
mensajeEliminacion = '';

onEliminarPaquete(paquete: Paquete): void {
  if (!this.isSuperAdmin) return;
  this.paqueteAEliminar = paquete;
  this.confirmacionTexto = '';
  this.errorEliminar = false;
  this.mensajeEliminacion = '';
  this.eliminandoPaquete = false;
  this.showDeleteModal = true;
  document.body.classList.add('no-scroll');
}

cancelarEliminacion(): void {
  this.showDeleteModal = false;
  this.paqueteAEliminar = null;
  this.confirmacionTexto = '';
  this.errorEliminar = false;
  this.mensajeEliminacion = '';
  this.eliminandoPaquete = false;
  document.body.classList.remove('no-scroll');
}

confirmarEliminacion(): void {
  if (this.confirmacionTexto !== 'ELIMINAR' || !this.paqueteAEliminar) {
    this.errorEliminar = true;
    return;
  }

  this.errorEliminar = false;
  this.eliminandoPaquete = true;
  this.mensajeEliminacion = '';

  this.paqueteService.eliminarPaquete(this.paqueteAEliminar.id_paquete).subscribe({
    next: () => {
      this.paquetes = this.paquetes.filter(p => p.id_paquete !== this.paqueteAEliminar!.id_paquete);
      this.aplicarFiltros();
      this.eliminandoPaquete = false;
      this.mensajeEliminacion = 'Paquete eliminado correctamente';
    },
    error: () => {
      this.eliminandoPaquete = false;
      this.errorEliminar = true;
      this.mensajeEliminacion = 'Error al eliminar paquete';
    }
  });
}


  openAddPaqueteModal(): void {
    if (!this.isSuperAdmin) return;
    this._editTarget = null;
    this.modalPaqueteModel = this.createEmptyPaquete();
    this.isEditMode = false;
    this.openModal();
  }

  openEditPaqueteModal(paquete: Paquete): void {
    if (!this.isSuperAdmin) return;
    this._editTarget = paquete;
    this.modalPaqueteModel = { ...paquete };
    this.isEditMode = true;
    this.openModal();
  }

  mensajeGuardado = '';

saveNewPaquete(form: NgForm): void {
  if (!form.valid || !this.isSuperAdmin) return;

  if (!this.modalPaqueteModel.nombre || !this.modalPaqueteModel.tipo || this.modalPaqueteModel.precio == null || !this.modalPaqueteModel.id_hotel || !this.modalPaqueteModel.id_lugar) {
    this.mensajeGuardado = '❌ Completa todos los campos obligatorios.';
    return;
  }

  this.savingModal = true;
  this.mensajeGuardado = '';

  this.paqueteService.crearPaquete(this.modalPaqueteModel).subscribe({
    next: (paquete) => {
      this.paquetes.unshift(paquete as Paquete);
      const hasLugar = Boolean(this.getLugarImage(paquete as Paquete));
      const hasHotel = Boolean(this.getHotelImage(paquete as Paquete));
      this.activeMedia.set((paquete as Paquete).id_paquete, hasLugar ? 'lugar' : (hasHotel ? 'hotel' : 'lugar'));

      this.aplicarFiltros();
      this.savingModal = false;
      this.mensajeGuardado = '✅ Paquete agregado correctamente';
    },
    error: (err) => {
      console.error('Error al agregar paquete:', err);
      this.savingModal = false;
      this.mensajeGuardado = '❌ Error al agregar paquete';
    }
  });
}

saveEditPaquete(form: NgForm): void {
  if (!form.valid || !this._editTarget || !this.isSuperAdmin) return;

  this.savingModal = true;
  this.mensajeGuardado = '';

  const payload: Paquete = {
    ...(this.modalPaqueteModel as Paquete),
    id_paquete: this._editTarget.id_paquete
  };

  this.paqueteService.actualizarPaquete(payload).subscribe({
    next: (p) => {
      Object.assign(this._editTarget!, p);
      const hasLugar = Boolean(this.getLugarImage(this._editTarget!));
      const hasHotel = Boolean(this.getHotelImage(this._editTarget!));
      if (!hasLugar && hasHotel) this.activeMedia.set(this._editTarget!.id_paquete, 'hotel');
      if (hasLugar && !hasHotel) this.activeMedia.set(this._editTarget!.id_paquete, 'lugar');

      this.aplicarFiltros();
      this.savingModal = false;
      this.mensajeGuardado = '✅ Paquete actualizado correctamente';
      this._editTarget = null;
    },
    error: (err) => {
      console.error('Error al actualizar paquete:', err);
      this.savingModal = false;
      this.mensajeGuardado = '❌ Error al actualizar paquete';
    }
  });
}


  closePaqueteModal(): void {
    if (this.savingModal) return;
    this.showModal = false;
    document.body.classList.remove('no-scroll');
  }

  private openModal(): void {
    this.showModal = true;
    document.body.classList.add('no-scroll');
  }

  private createEmptyPaquete(): Partial<Paquete> {
    return {
      id_paquete: undefined as any,
      nombre: '',
      tipo: '',
      precio: 0,
      id_hotel: undefined,
      id_lugar: undefined,
      estado: true
    };
  }

  onCardImageError(evt: Event): void {
    const img = evt.target as HTMLImageElement;
    img.src = 'assets/no-image.svg';
  }
  onAvatarError(evt: Event): void {
    const img = evt.target as HTMLImageElement;
    img.src = 'assets/no-image.svg';
  }

  hasBothImages(p: Paquete): boolean {
    return Boolean(this.getLugarImage(p) && this.getHotelImage(p));
  }

  switchMedia(id: number, kind: MediaKind): void {
    this.activeMedia.set(id, kind);
  }

  isActiveMedia(id: number, kind: MediaKind): boolean {
    const active = this.activeMedia.get(id);
    return active ? active === kind : kind === 'lugar';
  }

  getHotelImage(p: Paquete): string | null {
    return p.hotel?.url_imagen_hotel || null;
  }

  getLugarImage(p: Paquete): string | null {
    const l: any = (p as any).lugar;
    const src =
      l?.url_image_lugar_turistico ||
      l?.url_imagen_lugar ||
      l?.url_imagen ||
      l?.imagen_url ||
      l?.imagen ||
      l?.imageUrl ||
      null;
    return src;
  }

  private toStarScore10to5(score10: number): number {
    const s = Math.max(0, Math.min(10, Number(score10) || 0));
    return Math.round((s / 2) * 2) / 2;
  }
  getStarIcons(score10: number): ('full'|'half'|'empty')[] {
    const score5 = this.toStarScore10to5(score10);
    const full = Math.floor(score5);
    const half = score5 - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return [
      ...Array(full).fill('full' as const),
      ...Array(half).fill('half' as const),
      ...Array(empty).fill('empty' as const),
    ];
  }
  formatFiveScale(score10: number): string {
    return `${this.toStarScore10to5(score10).toFixed(1)}/5`;
  }

  trackByPaquete(_: number, item: Paquete): number {
    return item.id_paquete;
  }
}
