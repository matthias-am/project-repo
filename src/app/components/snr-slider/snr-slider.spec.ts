import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SnrSlider } from './snr-slider';

describe('SnrSlider', () => {
  let component: SnrSlider;
  let fixture: ComponentFixture<SnrSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SnrSlider]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SnrSlider);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
