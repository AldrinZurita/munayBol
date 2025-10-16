import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-registrarse',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule, // ✅ Necesario para [(ngModel)]
    RouterModule,
    HttpClientModule
  ],
  templateUrl: './registrarse.html',
  styleUrls: ['./registrarse.scss'],
  providers: [RegistrarseService]
})
export class Registrarse implements OnInit {
  form!: FormGroup;
  intentadoEnviar = false;
  verContrasenia = false;

  constructor(
    private fb: FormBuilder,
    private registroService: RegistrarseService,
    private router: Router
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

  validarCoincidencia(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('contrasenia')?.value;
    const confirm = group.get('confirmarContrasenia')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    this.intentadoEnviar = true;

    if (this.form.valid) {
      const datos = {
        nombre: this.form.value.nombre,
        correo: this.form.value.correo,
        contrasenia: this.form.value.contrasenia,
        pasaporte: this.form.value.pasaporte,
        pais: 'Bolivia'
      };

      this.registroService.registrarUsuario(datos).subscribe({
        next: (res) => {
          console.log('✅ Usuario creado:', res);
          this.router.navigate(['/login']);
        },
        error: (err) => {
          console.error('❌ Error al registrar:', err);
        }
      });
    } else {
      console.warn('⚠️ Formulario inválido');
      this.form.markAllAsTouched();
    }
  }
}
