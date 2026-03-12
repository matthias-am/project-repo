
import { Component, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { Chart, registerables } from 'chart.js';
import { ModulationParameter } from './modulation-parameter/modulation-parameter';
import { SnrInput } from './snr-input/snr-input';

declare global { interface Math { erfc(x: number): number; } }
Math.erfc = Math.erfc ?? ((x: number) => {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const tau = t * Math.exp(-x*x - 1.26551223 + t*(1.00002368 + t*(0.37409196 +
    t*(0.09678418 + t*(-0.18628806 + t*(0.27886807 + t*(-1.13520398 +
    t*(1.48851587 + t*(-0.82215223 + t*0.17087294)))))))));
  return x >= 0 ? tau : 2 - tau;
});

Chart.register(...registerables);

export interface SimulationConfig {
  modulationScheme: string;
  snr: number;
  awgn: number;
  interference: number;
  method: string;
}

export interface SimulationResults {
  requiredSnr: number;
  spectralEfficiency: number;
  errorRate: number;
  processingTime: number;
}

export interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface Collaborator {
  name: string;
  initials: string;
  color: string;
}

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatToolbarModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatDividerModule,
    ModulationParameter,
    SnrInput
  ],
  templateUrl: './simulation.html',
  styleUrl: './simulation.css'
})
export class SimulationComponent implements OnInit, OnDestroy, AfterViewChecked {

  config: SimulationConfig = {
    modulationScheme: 'QPSK',
    snr: 10,
    awgn: 0.5,
    interference: 0.1,
    method: 'Monte Carlo'
  };

  results: SimulationResults = {
    requiredSnr: 0,
    spectralEfficiency: 0,
    errorRate: 0,
    processingTime: 0
  };

  executionLogs: LogEntry[] = [];
  isRunning = false;
  hasResults = false;
  showDecisionBoundaries = true;
  showDistances = false;

  collaborators: Collaborator[] = [
    { name: 'Matthias Mohamed', initials: 'MM', color: '#06b6d4' },
    { name: 'Lionel Messi', initials: 'LM', color: '#8b5cf6' },
    { name: 'Lebron James', initials: 'LJ', color: '#ec4899' },
  ];

  private berChart: Chart | null = null;
  private constellationChart: Chart | null = null;
  private chartsInitialized = false;

  ngOnInit(): void {}

  ngAfterViewChecked(): void {
    if (this.hasResults && !this.chartsInitialized) {
      this.initCharts();
      this.chartsInitialized = true;
    }
  }

  ngOnDestroy(): void {
    this.berChart?.destroy();
    this.constellationChart?.destroy();
  }

  runSimulation(): void {
    this.isRunning = true;
    this.hasResults = false;
    this.chartsInitialized = false;
    this.executionLogs = [];
    this.berChart?.destroy();
    this.constellationChart?.destroy();

    const now = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

    this.addLog(now(), 'Simulation initialized', 'info');

    setTimeout(() => this.addLog(now(), `Processing ${this.config.method} iterations`, 'info'), 400);
    setTimeout(() => this.addLog(now(), 'Computing BER values', 'info'), 800);
    setTimeout(() => this.addLog(now(), 'Generating constellation points', 'info'), 1200);

    setTimeout(() => {
      this.results = this.computeResults();
      this.addLog(now(), 'Simulation completed successfully', 'success');
      this.isRunning = false;
      this.hasResults = true;
    }, 1800);
  }

  private computeResults(): SimulationResults {
    const snrLinear = Math.pow(10, this.config.snr / 10);
    const bitsPerSymbol: Record<string, number> = {
      'BPSK': 1, 'QPSK': 2, '16-QAM': 4, '64-QAM': 6, '256-QAM': 8
    };
    const bits = bitsPerSymbol[this.config.modulationScheme] || 2;
    const ber = (0.5 * Math.exp(-snrLinear / (2 * this.config.awgn))) + this.config.interference * 0.01;

    return {
      requiredSnr: this.config.snr,
      spectralEfficiency: bits,
      errorRate: Math.max(ber, 1e-7),
      processingTime: parseFloat((1.2 + Math.random() * 0.8).toFixed(1))
    };
  }

  private addLog(time: string, message: string, type: 'info' | 'success' | 'error'): void {
    this.executionLogs.push({ time, message, type });
  }

  private initCharts(): void {
    setTimeout(() => {
      this.initBerChart();
      this.initConstellationChart();
    }, 50);
  }

  private initBerChart(): void {
    const canvas = document.getElementById('berChart') as HTMLCanvasElement;
    if (!canvas) return;

    const snrValues = Array.from({ length: 21 }, (_, i) => i - 5);

    const berCurve = (snr: number, bits: number) => {
      const snrLin = Math.pow(10, snr / 10);
      return 0.5 * Math.erfc(Math.sqrt(snrLin / bits));
    };

    this.berChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: snrValues.map(v => `${v}`),
        datasets: [
          {
            label: 'BPSK',
            data: snrValues.map(s => berCurve(s, 1)),
            borderColor: '#22d3ee',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4
          },
          {
            label: 'QPSK',
            data: snrValues.map(s => berCurve(s, 2)),
            borderColor: '#818cf8',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4
          },
          {
            label: '16-QAM',
            data: snrValues.map(s => berCurve(s, 4)),
            borderColor: '#a78bfa',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'SNR (dB)', color: '#7d8590' },
            ticks: { color: '#7d8590' },
            grid: { color: 'rgba(125,133,144,0.15)' }
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Bit Error Rate (BER)', color: '#7d8590' },
            ticks: { color: '#7d8590' },
            grid: { color: 'rgba(125,133,144,0.15)' }
          }
        },
        plugins: {
          legend: { labels: { color: '#e6edf3' } }
        }
      }
    });
  }

  private initConstellationChart(): void {
    const canvas = document.getElementById('constellationChart') as HTMLCanvasElement;
    if (!canvas) return;

    const points = this.generateConstellationPoints();

    this.constellationChart = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [{
          label: this.config.modulationScheme,
          data: points,
          backgroundColor: 'rgba(34, 211, 238, 0.7)',
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'In-phase (I)', color: '#7d8590' },
            ticks: { color: '#7d8590' },
            grid: { color: 'rgba(125,133,144,0.15)' },
            min: -1.5, max: 1.5
          },
          y: {
            title: { display: true, text: 'Quadrature (Q)', color: '#7d8590' },
            ticks: { color: '#7d8590' },
            grid: { color: 'rgba(125,133,144,0.15)' },
            min: -1.5, max: 1.5
          }
        },
        plugins: {
          legend: { labels: { color: '#e6edf3' } }
        }
      }
    });
  }

  private generateConstellationPoints(): { x: number; y: number }[] {
    const noise = () => (Math.random() - 0.5) * this.config.awgn * 0.3;
    const pts: { x: number; y: number }[] = [];
    const scheme = this.config.modulationScheme;

    const basePoints: Record<string, { x: number; y: number }[]> = {
      'BPSK': [{ x: -1, y: 0 }, { x: 1, y: 0 }],
      'QPSK': [{ x: -1, y: 1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }],
      '16-QAM': [
        { x: -1, y: 1 }, { x: -0.33, y: 1 }, { x: 0.33, y: 1 }, { x: 1, y: 1 },
        { x: -1, y: 0.33 }, { x: -0.33, y: 0.33 }, { x: 0.33, y: 0.33 }, { x: 1, y: 0.33 },
        { x: -1, y: -0.33 }, { x: -0.33, y: -0.33 }, { x: 0.33, y: -0.33 }, { x: 1, y: -0.33 },
        { x: -1, y: -1 }, { x: -0.33, y: -1 }, { x: 0.33, y: -1 }, { x: 1, y: -1 }
      ],
      '64-QAM': (() => {
        const p = [];
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 8; j++)
            p.push({ x: -1 + i * (2 / 7), y: -1 + j * (2 / 7) });
        return p;
      })(),
      '256-QAM': (() => {
        const p = [];
        for (let i = 0; i < 16; i++)
          for (let j = 0; j < 16; j++)
            p.push({ x: -1 + i * (2 / 15), y: -1 + j * (2 / 15) });
        return p;
      })()
    };

    const base = basePoints[scheme] || basePoints['QPSK'];
    base.forEach(p => {
      for (let i = 0; i < 8; i++) {
        pts.push({ x: p.x + noise(), y: p.y + noise() });
      }
    });

    return pts;
  }

  onShare(): void { console.log('Share clicked'); }
  onSave(): void { console.log('Save clicked'); }
  onExport(): void { console.log('Export clicked'); }
}