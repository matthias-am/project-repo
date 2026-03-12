import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultsTable } from './results-table';

describe('ResultsTable', () => {
  let component: ResultsTable;
  let fixture: ComponentFixture<ResultsTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsTable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultsTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
