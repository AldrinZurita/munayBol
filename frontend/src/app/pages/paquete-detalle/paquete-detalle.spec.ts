import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaqueteDetalle } from './paquete-detalle';

describe('PaqueteDetalle', () => {
  let component: PaqueteDetalle;
  let fixture: ComponentFixture<PaqueteDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaqueteDetalle]
    }).compileComponents();

    fixture = TestBed.createComponent(PaqueteDetalle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
