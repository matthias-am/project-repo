import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModulationParameter } from './modulation-parameter';

describe('ModulationParameter', () => {
  let component: ModulationParameter;
  let fixture: ComponentFixture<ModulationParameter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModulationParameter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModulationParameter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
