import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BerGraph } from './ber-graph';

describe('BerGraph', () => {
  let component: BerGraph;
  let fixture: ComponentFixture<BerGraph>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BerGraph]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BerGraph);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
