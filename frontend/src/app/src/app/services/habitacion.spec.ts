import { TestBed } from '@angular/core/testing';

import { Habitacion } from './habitacion';

describe('Habitacion', () => {
  let service: Habitacion;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Habitacion);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
