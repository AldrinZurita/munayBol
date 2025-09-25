import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LugaresTuristicosDetalle } from './lugares-turisticos-detalle';

describe('LugaresTuristicosDetalle', () => {
  let component: LugaresTuristicosDetalle;
  let fixture: ComponentFixture<LugaresTuristicosDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LugaresTuristicosDetalle]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LugaresTuristicosDetalle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
