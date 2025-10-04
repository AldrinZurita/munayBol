import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaqueteDetalle } from './paquete-detalle';
import { ActivatedRoute } from '@angular/router';

describe('PaqueteDetalle', () => {
  let component: PaqueteDetalle;
  let fixture: ComponentFixture<PaqueteDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaqueteDetalle],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => '1'
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PaqueteDetalle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería cargar el paquete con id 1', () => {
    expect(component.paquete).toBeDefined();
    expect(component.paquete.id).toBe('1');
    expect(component.paquete.lugar_turistico).toBe('Salar de Uyuni');
  });
});
