import { Component, Inject, PLATFORM_ID, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, LoginResponse, GithubLoginUrlResponse } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') passwordInput?: ElementRef<HTMLInputElement>;

  correo = '';
  contrasenia = '';
  error = '';
  loading = false;
  isBrowser = false;

  // UI state
  passwordVisible = false;
  googleReady = false;
  githubLoading = false;

  // Background (Cloudinary)
  loginBackgroundUrl = 'https://res.cloudinary.com/dj5uzus8e/image/upload/v1761429463/wjrh01yodnvwtcvlqogp.jpg';

  // Cleanup
  private removeResize?: () => void;
  private googleInitInterval?: number;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) setTimeout(() => this.emailInput?.nativeElement?.focus(), 200);

    // Google Identity Services
    if (this.isBrowser) {
      const initGoogle = () => {
        if (!environment.googleClientId) {
          // eslint-disable-next-line no-console
          console.warn('Falta environment.googleClientId. Google no estará disponible.');
          return;
        }
        if (typeof google !== 'undefined' && google?.accounts?.id) {
          google.accounts.id.initialize({
            client_id: environment.googleClientId,
            callback: (response: unknown) => this.handleGoogleCredential(response as { credential?: string }),
            auto_select: false,
            itp_support: true,
            use_fedcm_for_prompt: true
          });
          this.renderGoogleButton();

          // Re-render al redimensionar
          let raf = 0;
          const onResize = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => this.renderGoogleButton());
          };
          window.addEventListener('resize', onResize);
          this.removeResize = () => window.removeEventListener('resize', onResize);
        }
      };

      if ((window as any).google) {
        initGoogle();
      } else {
        this.googleInitInterval = window.setInterval(() => {
          if ((window as any).google) {
            if (this.googleInitInterval) window.clearInterval(this.googleInitInterval);
            initGoogle();
          }
        }, 200) as unknown as number;
        setTimeout(() => {
          if (this.googleInitInterval) window.clearInterval(this.googleInitInterval);
        }, 10000);
      }
    }

    // Callback de GitHub si vuelve de OAuth
    if (this.isBrowser) {
      this.route.queryParamMap.subscribe(params => {
        const code = params.get('code');
        const state = params.get('state');
        if (code && state) {
          this.loading = true;
          this.githubLoading = false;
          this.auth.githubExchange(code, state).subscribe({
            next: async (resp: LoginResponse) => {
              this.loading = false;
              this.snackBar.open('¡Inicio de sesión con GitHub exitoso!', '', { duration: 2500 });
              await this.router.navigate([], { queryParams: {}, replaceUrl: true });
              if (resp.usuario.rol === 'superadmin') await this.router.navigate(['/admin']);
              else await this.router.navigate(['/']);
            },
            error: (_err: unknown) => {
              this.loading = false;
              this.snackBar.open('Error al iniciar sesión con GitHub', '', { duration: 2500 });
            }
          });
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.removeResize?.();
    if (this.googleInitInterval) window.clearInterval(this.googleInitInterval);
  }

  private renderGoogleButton(): void {
    const host = document.getElementById('googleButton');
    if (!host) return;

    // Limpia render previo
    host.innerHTML = '';

    if (typeof google !== 'undefined' && google?.accounts?.id) {
      google.accounts.id.renderButton(host, {
        type: 'icon',
        shape: 'circle',
        theme: 'outline',
        size: 'large'
      });

      // Verifica que el botón haya quedado visible; si no, crea un fallback con SVG
      setTimeout(() => {
        const rendered = host.querySelector('iframe, div[role="button"]');
        if (!rendered) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'oauth-fallback google';
          btn.innerHTML = `
            <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path fill="#FFC107" d="M43.61 20.083h-1.86V20H24v8h11.303c-1.65 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.06 0 5.84 1.153 7.957 3.043l5.657-5.657C36.043 6.06 30.305 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.34-.138-2.648-.39-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.818C14.505 16.17 18.868 14 24 14c3.06 0 5.84 1.153 7.957 3.043l5.657-5.657C36.043 6.06 30.305 4 24 4 16.318 4 9.7 8.335 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.176 0 9.86-1.987 13.4-5.223l-6.197-5.238C29.122 35.59 26.71 36.5 24 36.5c-5.201 0-9.616-3.324-11.28-7.96l-6.5 5.006C9.606 39.47 16.235 44 24 44z"/>
              <path fill="#1976D2" d="M43.61 20.083H42V20H24v8h11.303c-.79 2.223-2.241 4.109-4.1 5.478v.001l6.197 5.238C39.728 35.89 44 30.5 44 24c0-1.34-.138-2.648-.39-3.917z"/>
            </svg>`;
          btn.addEventListener('click', () => {
            try {
              google.accounts.id.prompt();
            } catch {
              // no-op
            }
          });
          host.appendChild(btn);
        }
        this.googleReady = true;
      }, 60);
    }
  }

  // Acciones
  onKeyDownEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.loading) this.login();
  }

  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
    setTimeout(() => this.passwordInput?.nativeElement?.focus(), 0);
  }

  loginWithGitHub(): void {
    if (!this.isBrowser || this.loading) return;
    this.githubLoading = true;
    this.auth.githubLoginUrl().subscribe({
      next: (data: GithubLoginUrlResponse) => {
        const { authorize_url } = data;
        window.location.href = authorize_url;
      },
      error: (_err: unknown) => {
        this.githubLoading = false;
        this.snackBar.open('No se pudo iniciar el flujo de GitHub', '', { duration: 2500 });
      }
    });
  }

  private handleGoogleCredential(response: { credential?: string } | null): void {
    const id_token = response?.credential;
    if (!id_token) {
      this.snackBar.open('No se recibió el token de Google', '', { duration: 2500 });
      return;
    }
    this.loading = true;
    this.auth.googleLogin(id_token).subscribe({
      next: async (resp: LoginResponse) => {
        this.loading = false;
        this.snackBar.open('¡Inicio de sesión con Google exitoso!', '', { duration: 2500 });
        if (resp.usuario.rol === 'superadmin') await this.router.navigate(['/admin']);
        else await this.router.navigate(['/']);
      },
      error: (_err: unknown) => {
        this.loading = false;
        this.snackBar.open('Error al iniciar sesión con Google', '', { duration: 2500 });
      }
    });
  }

  login(): void {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    this.auth.login({ correo: this.correo, contrasenia: this.contrasenia }).subscribe({
      next: async (resp: LoginResponse) => {
        if (resp.usuario && resp.usuario.estado) {
          this.snackBar.open('¡Inicio de sesión exitoso!', '', { duration: 2500 });
          if (resp.usuario.rol === 'superadmin') await this.router.navigate(['/admin']);
          else await this.router.navigate(['/']);
        } else {
          this.error = 'Usuario inactivo o no autorizado.';
          this.auth.logout();
        }
        this.loading = false;
      },
      error: (_err: unknown) => {
        this.error = 'Credenciales inválidas o usuario no autorizado.';
        this.snackBar.open(this.error, '', { duration: 2500 });
        this.loading = false;

        const card = document.querySelector('.login-card');
        if (card) {
          card.classList.remove('shake');
          void (card as HTMLElement).offsetWidth;
          card.classList.add('shake');
          setTimeout(() => card.classList.remove('shake'), 600);
        }
      }
    });
  }

  get passwordType(): 'text' | 'password' {
    return this.passwordVisible ? 'text' : 'password';
  }
}
