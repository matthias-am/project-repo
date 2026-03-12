// modulation-parameter.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-modulation-parameter',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './modulation-parameter.html',
  styleUrl: './modulation-parameter.css'
})
export class ModulationParameter {
  @Input() selectedScheme: string = 'QPSK';
  @Input() selectedMethod: string = 'Monte Carlo';

  @Output() schemeChange = new EventEmitter<string>();
  @Output() methodChange = new EventEmitter<string>();

  onSchemeChange(value: string): void {
    this.schemeChange.emit(value);
  }

  onMethodChange(value: string): void {
    this.methodChange.emit(value);
  }
}