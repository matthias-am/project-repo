import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SnrInput } from './snr-input';

describe('SnrInput', () => {
  let component: SnrInput;
  let fixture: ComponentFixture<SnrInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SnrInput]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SnrInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
