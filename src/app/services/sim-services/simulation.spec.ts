import { TestBed } from '@angular/core/testing';

import { SimulationComponent } from '../../components/simulation/simulation';

describe('Simulation', () => {
  let service: SimulationComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulationComponent);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
