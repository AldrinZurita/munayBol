import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Habitaciones } from './habitaciones';

describe('Habitaciones', () => {
  let component: Habitaciones;
  let fixture: ComponentFixture<Habitaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Habitaciones]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Habitaciones);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
