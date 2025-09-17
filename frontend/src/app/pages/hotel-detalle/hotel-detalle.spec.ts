import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HotelDetalle } from './hotel-detalle';

describe('HotelDetalle', () => {
  let component: HotelDetalle;
  let fixture: ComponentFixture<HotelDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotelDetalle]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HotelDetalle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
