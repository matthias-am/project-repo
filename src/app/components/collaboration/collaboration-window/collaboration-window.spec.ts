import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollaborationWindow } from './collaboration-window';

describe('CollaborationWindow', () => {
  let component: CollaborationWindow;
  let fixture: ComponentFixture<CollaborationWindow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollaborationWindow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CollaborationWindow);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
