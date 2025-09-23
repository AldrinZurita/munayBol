import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LugaresTuristicos } from './lugares-turisticos';

describe('LugaresTuristicos', () => {
  let component: LugaresTuristicos;
  let fixture: ComponentFixture<LugaresTuristicos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LugaresTuristicos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LugaresTuristicos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
