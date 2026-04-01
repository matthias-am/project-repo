import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-modulation-parameter',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './modulation-parameter.html', //Link to HTML template
  styleUrl: './modulation-parameter.css' //Link to styles
})
export class ModulationParameter {
  //default values for when the page loads
  @Input() selectedScheme: string = 'QPSK';
  @Input() selectedMethod: string = 'Monte Carlo';

  //Emits when user changes scheme and method
  @Output() schemeChange = new EventEmitter<string>();
  @Output() methodChange = new EventEmitter<string>();

  //forward the new value to the parent component
  onSchemeChange(value: string): void {
    this.schemeChange.emit(value);
  }
  //forward the new value to the parent component
  onMethodChange(value: string): void {
    this.methodChange.emit(value);
  }
}