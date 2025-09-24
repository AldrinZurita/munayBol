import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotelDetalle } from './hotel-detalle';

describe('HotelDetalle', () => {
  let component: HotelDetalle;
  let fixture: ComponentFixture<HotelDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotelDetalle]
    }).compileComponents();

    fixture = TestBed.createComponent(HotelDetalle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have fake reviews defined', () => {
    expect(component.reviews.length).toBeGreaterThan(0);
  });

  it('should show reservar function', () => {
    spyOn(window, 'alert');
    component.reservar();
    expect(window.alert).toHaveBeenCalledWith('Funcionalidad de reserva en construccion 🚀');
  });
});
