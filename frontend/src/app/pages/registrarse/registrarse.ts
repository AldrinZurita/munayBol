import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-registrarse',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './registrarse.html',
  styleUrls: ['./registrarse.scss'],
})
export class Registrarse implements OnInit {
  form!: FormGroup;
  intentadoEnviar = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
        pasaporte: ['', Validators.required],
      },
      { validators: this.passwordsMatchValidator }
    );
  }

  passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordsMismatch: true };
  }

  onSubmit(): void {
    this.intentadoEnviar = true;

    if (this.form.valid) {
      const passwordValue = this.form.value.password;

      const datos = {
        nombre: this.form.value.name,
        correo: this.form.value.email,
        contrasenia: passwordValue,       // ✅ requerido por tu modelo
        password: passwordValue,          // ✅ requerido por Django internamente
        pasaporte: this.form.value.pasaporte,
        pais: 'Bolivia',                  // ✅ valor fijo
        rol: 'Usuario',                   // ✅ valor por defecto
        estado: true                      // ✅ valor por defecto
      };

      console.log('✅ Datos enviados al backend:', datos);
      // Aquí podrías enviar los datos al backend con HttpClient

    } else {
      console.warn('⚠️ Formulario inválido');
      this.form.markAllAsTouched();
    }
  }
}
