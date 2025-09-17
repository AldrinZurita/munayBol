import { TestBed } from '@angular/core/testing';

import { Hotel } from './hotel';

describe('Hotel', () => {
  let service: Hotel;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Hotel);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
