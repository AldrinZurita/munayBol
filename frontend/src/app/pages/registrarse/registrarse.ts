import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
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

  roles = [
    { label: 'Usuario Normal', value: 'normal' },
    { label: 'Admin de Hotel', value: 'hotelAdmin' },
    { label: 'Super Administrador', value: 'superAdmin' },
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
        role: ['normal', Validators.required],
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
    if (this.form.valid) {
      console.log('✅ Datos del formulario:', this.form.value);
      // Aquí podrías enviar los datos al backend o mostrar un mensaje de éxito
    } else {
      console.warn('⚠️ Formulario inválido');
      this.form.markAllAsTouched();
    }
  }
}
