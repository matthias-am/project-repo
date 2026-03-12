import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatSliderModule} from '@angular/material/slider';

@Component({
  selector: 'app-snr-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSliderModule],
  templateUrl: './snr-input.html',
  styleUrls: ['./snr-input.css'],
})
export class SnrInput {
  @Input() snr: number = 0;
  @Input() awgn: number = 0;
  @Input() interference: number = 0;

  @Output() snrChange = new EventEmitter<number>();
  @Output() awgnChange = new EventEmitter<number>();
  @Output() interferenceChange = new EventEmitter<number>();

  onSnrChange(value: number): void
{
  this.snr = value;
  this.snrChange.emit(value);
}

onAwgnChange(value: number): void {
  this.awgn = value;
  this.awgnChange.emit(value);
}

  onInterferenceChange(value: number): void {
    this.interference = value;
    this.interferenceChange.emit(value);
  }

}
