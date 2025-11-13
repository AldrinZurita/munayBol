import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { RegistrarseService } from '../../services/registrarse.service';
import { LoadingService } from '../../shared/services/loading';

@Component({
  selector: 'app-registrarse',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    HttpClientModule
  ],
  templateUrl: './registrarse.html',
  styleUrls: ['./registrarse.scss'],
  providers: [RegistrarseService]
})
export class Registrarse implements OnInit, OnDestroy {
  form!: FormGroup;
  intentadoEnviar = false;
  verContrasenia = false;
  loading = false;
  showRegistroSuccessModal = false;
  successNombre = '';
  backgroundUrl =
    'https://res.cloudinary.com/dj5uzus8e/image/upload/v1761429463/wjrh01yodnvwtcvlqogp.jpg';

  constructor(
    private fb: FormBuilder,
    private registroService: RegistrarseService,
    private router: Router,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        nombre: ['', Validators.required],
        correo: ['', [Validators.required, Validators.email]],
        contrasenia: ['', [Validators.required, Validators.minLength(6)]],
        confirmarContrasenia: ['', Validators.required],
        pasaporte: ['', Validators.required]
      },
      { validators: this.validarCoincidencia }
    );
  }

  ngOnDestroy(): void {
    this.loadingService.hide();
  }

  validarCoincidencia(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('contrasenia')?.value;
    const confirm = group.get('confirmarContrasenia')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  get f(): { [key: string]: AbstractControl } {
    return this.form.controls;
  }

  toggleVerContrasenia(): void {
    this.verContrasenia = !this.verContrasenia;
  }

  onSubmit(): void {
    this.intentadoEnviar = true;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.loading) return;
    this.loading = true;
    this.loadingService.show('Creando tu cuenta...');

    const datos = {
      nombre: this.form.value.nombre,
      correo: this.form.value.correo,
      contrasenia: this.form.value.contrasenia,
      pasaporte: this.form.value.pasaporte,
      pais: 'Bolivia'
    };

    this.registroService.registrarUsuario(datos).subscribe({
      next: (res) => {
        console.log('Usuario creado correctamente!:', res);
        this.successNombre = this.form.value.nombre;
        this.showRegistroSuccessModal = true;
        this.loading = false;
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Error al registrar!:', err);
        this.loading = false;
        this.loadingService.hide();
        const errorMsg = err.error?.correo?.[0] || 'No se pudo completar el registro. Verifica tus datos.';
        alert(errorMsg);
      }
    });
  }

  cerrarRegistroSuccess(): void {
    this.showRegistroSuccessModal = false;
    this.router.navigate(['/login']);
  }
}
