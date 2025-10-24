import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
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
export class LoginComponent implements OnInit {
  correo = '';
  contrasenia = '';
  error = '';
  loading = false;
  isBrowser = false;

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
    // 1) Inicializar Google button solo en navegador
    if (this.isBrowser) {
      const initGoogle = () => {
        if (!environment.googleClientId) return;
        if (typeof google !== 'undefined') {
          google.accounts.id.initialize({
            client_id: environment.googleClientId,
            callback: (response: unknown) => this.handleGoogleCredential(response as { credential?: string }),
          });
          const btn = document.getElementById('googleButton');
          if (btn) {
            google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large' });
          }
        }
      };
      if ((window as any).google) {
        initGoogle();
      } else {
        const itv = setInterval(() => {
          if ((window as any).google) {
            clearInterval(itv);
            initGoogle();
          }
        }, 200);
      }
    }

    // 2) Manejar callback de GitHub (code + state) SOLO en navegador (evita SSR)
    if (this.isBrowser) {
      this.route.queryParamMap.subscribe(params => {
        const code = params.get('code');
        const state = params.get('state');

        if (code && state) {
          // Debug opcional
          // console.log('GitHub callback params:', { code, state });

          this.loading = true;
          this.auth.githubExchange(code, state).subscribe({
            next: async (resp: LoginResponse) => {
              this.loading = false;
              this.snackBar.open('¡Inicio de sesión con GitHub exitoso!', '', { duration: 2500 });
              // Limpia la URL (quita ?code&state)
              await this.router.navigate([], { queryParams: {}, replaceUrl: true });

              if (resp.usuario.rol === 'superadmin') {
                await this.router.navigate(['/admin']);
              } else {
                await this.router.navigate(['/']);
              }
            },
            error: (err: unknown) => {
              this.loading = false;
              // eslint-disable-next-line no-console
              console.error('GitHub exchange error:', err);
              this.snackBar.open('Error al iniciar sesión con GitHub', '', { duration: 2500 });
            }
          });
        }
      });
    }
  }

  loginWithGitHub(): void {
    if (!this.isBrowser) return;
    this.auth.githubLoginUrl().subscribe({
      next: (data: GithubLoginUrlResponse) => {
        const { authorize_url } = data;
        // Debug opcional:
        // console.log('Redirecting to GitHub authorize URL:', authorize_url);
        window.location.href = authorize_url;
      },
      error: (err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('githubLoginUrl error:', err);
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
        if (resp.usuario.rol === 'superadmin') {
          await this.router.navigate(['/admin']);
        } else {
          await this.router.navigate(['/']);
        }
      },
      error: (err: unknown) => {
        this.loading = false;
        // eslint-disable-next-line no-console
        console.error('Google login error:', err);
        this.snackBar.open('Error al iniciar sesión con Google', '', { duration: 2500 });
      }
    });
  }

  login(): void {
    this.loading = true;
    this.error = '';
    this.auth.login({ correo: this.correo, contrasenia: this.contrasenia }).subscribe({
      next: async (resp: LoginResponse) => {
        if (resp.usuario && resp.usuario.estado) {
          this.snackBar.open('¡Inicio de sesión exitoso!', '', { duration: 2500 });
          if (resp.usuario.rol === 'superadmin') {
            await this.router.navigate(['/admin']);
          } else {
            await this.router.navigate(['/']);
          }
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
      }
    });
  }
}
