import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Registrarse } from './registrarse';

describe('Registrarse', () => {
  let component: Registrarse;
  let fixture: ComponentFixture<Registrarse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Registrarse],
      imports: [ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(Registrarse);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería tener el formulario inválido al inicio', () => {
    expect(component.form.valid).toBeFalse();
  });

  it('debería validar el campo email correctamente', () => {
    const emailControl = component.form.get('email');
    emailControl?.setValue('correo@invalido');
    expect(emailControl?.valid).toBeFalse();

    emailControl?.setValue('correo@valido.com');
    expect(emailControl?.valid).toBeTrue();
  });

  it('debería aceptar el envío si el formulario es válido', () => {
    component.form.setValue({
      name: 'Jesús',
      email: 'jesus@email.com',
      password: '123456',
      confirmPassword: '123456',
      role: 'normal',
    });

    spyOn(console, 'log');
    component.onSubmit();
    expect(console.log).toHaveBeenCalledWith('Datos del formulario:', component.form.value);
  });
});
