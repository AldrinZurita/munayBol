import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  RouterModule,
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  Event as RouterEvent,
} from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Usuario } from '../../interfaces/usuario.interface';
import { NotificationComponent } from '../components/notification/notification.component';

type PaletteItem = { label: string; icon: string; path: string };

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationComponent],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss']
})
export class NavbarComponent implements OnInit, OnDestroy, AfterViewInit {
  isLoggedIn = false;
  username = '';
  user: Usuario | null = null;

  mobileOpen = false;
  userMenuOpen = false;

  scrolled = false;
  atTop = true;
  hidden = false;
  mounted = false;
  scrollProgress = 0;
  routeLoading = false;
  shrink = false;
  routeHome = true;
  headerContrast: 'light' | 'dark' = 'light';

  @ViewChild('navList', { static: false }) navListRef?: ElementRef<HTMLUListElement>;
  inkVisible = false;
  inkX = 0;
  inkW = 0;
  get inkTransform(): string { return `translateX(${this.inkX}px)`; }

  // Command palette
  paletteOpen = false;
  paletteQuery = '';
  readonly paletteItems: PaletteItem[] = [
    { label: 'Inicio', icon: 'home', path: '/' },
    { label: 'Lugares Turísticos', icon: 'attractions', path: '/lugares-turisticos' },
    { label: 'Paquetes', icon: 'card_travel', path: '/paquetes' },
    { label: 'Hoteles', icon: 'hotel', path: '/hoteles' },
    { label: 'Mi Perfil', icon: 'account_circle', path: '/perfil' },
  ];
  get filteredPalette(): PaletteItem[] {
    const q = this.paletteQuery.trim().toLowerCase();
    if (!q) return this.paletteItems;
    return this.paletteItems.filter(i => i.label.toLowerCase().includes(q));
  }

  private readonly isBrowser: boolean;
  private lastScrollY = 0;
  private routerSub?: { unsubscribe(): void };

  constructor(
    private authService: AuthService,
    private router: Router,
    private el: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.authService.user$.subscribe((user: Usuario | null) => {
      this.user = user;
      this.isLoggedIn = !!user;
      this.username = user ? (user.nombre || user.correo || '') : '';
    });

    if (this.isBrowser) {
      this.lastScrollY = window.scrollY || 0;
      this.scrolled = this.lastScrollY > 4;
      this.atTop = this.lastScrollY <= 4;
      this.shrink = this.lastScrollY > 120;
      this.updateProgress();

      requestAnimationFrame(() => {
        this.mounted = true;
        this.updateHeaderContrast();
        this.syncActiveInk();
      });

      this.routerSub = this.router.events.subscribe((ev: RouterEvent) => {
        if (ev instanceof NavigationStart) {
          this.routeLoading = true;
          this.hidden = false;
        } else if (ev instanceof NavigationEnd) {
          this.routeLoading = false;
          const url = ev.urlAfterRedirects || ev.url;
          this.routeHome = url.split('?')[0] === '/';
          this.updateHeaderContrast();
          setTimeout(() => this.syncActiveInk(), 0);
        } else if (ev instanceof NavigationCancel || ev instanceof NavigationError) {
          this.routeLoading = false;
        }
      });
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    setTimeout(() => this.syncActiveInk(), 0);
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  // Ink indicator helpers
  onNavItemEnter(ev: Event): void {
    if (!this.isBrowser || !this.navListRef) return;
    const target = ev.currentTarget as HTMLElement;
    this.positionInkTo(target);
  }
  clearInk(): void { this.syncActiveInk(); }
  private syncActiveInk(): void {
    if (!this.isBrowser || !this.navListRef) return;
    const active = this.navListRef.nativeElement.querySelector('a.active') as HTMLElement | null;
    if (active) this.positionInkTo(active);
    else {
      this.inkVisible = false;
      this.inkX = 0;
      this.inkW = 0;
    }
  }
  private positionInkTo(elm: HTMLElement): void {
    const list = this.navListRef!.nativeElement;
    const lr = list.getBoundingClientRect();
    const r = elm.getBoundingClientRect();
    this.inkX = r.left - lr.left;
    this.inkW = r.width;
    this.inkVisible = true;
  }

  // Visual feedback
  onNavItemSelect(ev: Event): void {
    const a = ev.currentTarget as HTMLElement;
    this.applyFlash(a);
    this.positionInkTo(a);
  }
  onControlSelect(ev: Event): void {
    const el = ev.currentTarget as HTMLElement;
    this.applyFlash(el);
  }
  private applyFlash(el: HTMLElement): void {
    el.classList.remove('flash');
    // reflow para reiniciar animación
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetWidth;
    el.classList.add('flash');
  }

  // Palette
  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(ev: KeyboardEvent): void {
    if (!this.isBrowser) return;
    const isCmdK = (ev.key.toLowerCase() === 'k') && (ev.ctrlKey || ev.metaKey);
    if (isCmdK) {
      ev.preventDefault();
      this.paletteOpen = !this.paletteOpen;
      this.paletteQuery = '';
      this.hidden = false;
    }
    if (ev.key === 'Escape' && this.paletteOpen) {
      ev.preventDefault();
      this.paletteOpen = false;
    }
  }
  openPalette(): void { this.paletteOpen = true; this.hidden = false; }
  closePalette(): void { this.paletteOpen = false; }
  onPaletteInput(value: string): void { this.paletteQuery = value; }
  go(item: PaletteItem): void {
    this.paletteOpen = false;
    void this.router.navigate([item.path]);
  }

  // Scroll + resize
  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;

    const y = window.scrollY || 0;
    const delta = y - this.lastScrollY;

    this.scrolled = y > 4;
    this.atTop = y <= 4;
    this.shrink = y > 120;

    if (this.mobileOpen) {
      this.hidden = false;
      this.lastScrollY = y;
    } else {
      const downThreshold = 12;
      const upThreshold = 4;
      if (y > 64 && delta > downThreshold) this.hidden = true;
      else if (delta < -upThreshold) this.hidden = false;
      this.lastScrollY = y;
    }

    this.updateProgress();
    this.updateHeaderContrastThrottled();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) return;
    this.syncActiveInk();
  }

  private updateProgress(): void {
    if (!this.isBrowser) return;
    const doc = document.documentElement;
    const scrollable = Math.max(0, doc.scrollHeight - doc.clientHeight);
    const y = window.scrollY || 0;
    this.scrollProgress = scrollable > 0 ? Math.min(100, Math.max(0, (y / scrollable) * 100)) : 0;
  }

  // Contraste dinámico del header
  private updateHeaderContrast(): void {
    if (!this.isBrowser) return;

    const el = document.getElementById('header-contrast');
    const attr = el?.getAttribute('data-contrast');
    if (attr === 'light' || attr === 'dark') { this.headerContrast = attr; return; }

    const meta = document.querySelector('meta[name="theme-contrast"]') as HTMLMetaElement | null;
    const metaContent = meta?.content?.trim().toLowerCase();
    if (metaContent === 'light' || metaContent === 'dark') { this.headerContrast = metaContent; return; }

    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const luma = this.parseLuma(bodyBg);
    this.headerContrast = luma > 0.6 ? 'dark' : 'light';
  }
  private parseLuma(rgb: string): number {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return 0;
    const r = parseInt(m[1], 10) / 255;
    const g = parseInt(m[2], 10) / 255;
    const b = parseInt(m[3], 10) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  private updateHeaderContrastThrottled = (() => {
    let ticking = false;
    return () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        this.updateHeaderContrast();
        ticking = false;
      });
    };
  })();

  // Menús y logout
  toggleMobile(): void {
    this.mobileOpen = !this.mobileOpen;
    if (this.mobileOpen) { this.hidden = false; }
  }
  onNavLinkClick(): void { this.mobileOpen = false; }
  toggleUserMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }
  closeMenus(): void {
    this.mobileOpen = false;
    this.userMenuOpen = false;
  }
  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  // Cerrar con clics fuera / Esc
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isBrowser) return;
    const root = this.el.nativeElement;
    if (!root.contains(event.target as Node)) this.closeMenus();
  }
  @HostListener('document:keydown', ['$event'])
  onDocKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') this.closeMenus();
  }
}
