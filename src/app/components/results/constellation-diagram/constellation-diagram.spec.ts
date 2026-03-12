import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConstellationDiagram } from './constellation-diagram';

describe('ConstellationDiagram', () => {
  let component: ConstellationDiagram;
  let fixture: ComponentFixture<ConstellationDiagram>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConstellationDiagram]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConstellationDiagram);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
