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
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription } from 'rxjs';
import { Chart, registerables } from 'chart.js';

import { ModulationParameter } from './modulation-parameter/modulation-parameter';
import { SnrInput } from './snr-input/snr-input';
import { SimulationService, SimulationResults, RunStatusResponse } from '../../services/simulation.service';
import { WorkspaceService } from '../../services/workspace.service';
import { Auth } from '../../services/auth';

Chart.register(...registerables);

export interface SimulationConfig {
  modulationScheme: string;
  snr: number;        // used as const_ebn0_db
  awgn: number;
  interference: number;
  method: string;
  snr_min: number;
  snr_max: number;
  snr_step: number;
  num_bits: number;
  num_symbols: number;
}

export interface DisplayResults {
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
  status: 'active' | 'idle';
  activity: string;
}

// Map UI scheme names to backend schemeIds
const SCHEME_MAP: Record<string, string> = {
  'BPSK':    'bpsk',
  'QPSK':    'qpsk',
  '16-QAM':  '16qam',
  '64-QAM':  '64qam',
  '256-QAM': '256qam',
};

const BITS_PER_SYMBOL: Record<string, number> = {
  'BPSK': 1, 'QPSK': 2, '16-QAM': 4, '64-QAM': 6, '256-QAM': 8
};

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatToolbarModule, MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSlideToggleModule, MatDividerModule, MatInputModule, MatChipsModule,
    ModulationParameter, SnrInput
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
    method: 'Monte Carlo',
    snr_min: 0,
    snr_max: 20,
    snr_step: 2,
    num_bits: 100000,
    num_symbols: 3000,
  };

  results: DisplayResults = {
    requiredSnr: 0,
    spectralEfficiency: 0,
    errorRate: 0,
    processingTime: 0
  };

  executionLogs: LogEntry[] = [];
  isRunning      = false;
  hasResults     = false;
  showDecisionBoundaries = true;
  showDistances  = false;

  // Panel state
  showSavePanel   = false;
  showExportPanel = false;
  showSharePanel  = false;

  // Save panel
  simulationName        = `QPSK Analysis - ${new Date().toLocaleDateString('en-CA')}`;
  simulationDescription = '';
  availableTags = ['BER Analysis', '4G', '5G', 'High SNR', 'Low SNR', 'QAM', 'PSK', 'Research', 'Teaching', 'Comparison'];
  selectedTags:  string[] = [];
  saveDone       = false;
  saveError      = '';

  // Export panel
  exportFormat: 'json' | 'csv' | 'pdf' | 'png' = 'json';
  exportIncludeParams  = true;
  exportIncludeResults = true;
  exportIncludeVisuals = true;

  // Share panel
  shareLink      = 'https://modsim.pro/share/x8po';
  allowEditing   = true;
  allowComments  = true;
  shareTab: 'link' | 'invite' | 'users' = 'link';
  inviteEmail    = '';
  linkCopied     = false;

  collaborators: Collaborator[] = [
    { name: 'Sarah Chen',        initials: 'SC', color: '#06b6d4', status: 'active', activity: 'Adjusting SNR parameter' },
    { name: 'Michael Rodriguez', initials: 'MR', color: '#8b5cf6', status: 'active', activity: 'Viewing BER graph'        },
    { name: 'Emily Watson',      initials: 'EW', color: '#ec4899', status: 'idle',   activity: 'Idle for 5 minutes'       },
  ];

  private berChart:           Chart | null = null;
  private constellationChart: Chart | null = null;
  private chartsInitialized  = false;
  private pollSub?:           Subscription;
  private currentRunId?:      string;
  private rawResults?:        SimulationResults;

  constructor(
    private simService:  SimulationService,
    private wsService:   WorkspaceService,
    private auth:        Auth
  ) {}

  ngOnInit(): void {
    // Ensure workspace is loaded
    this.wsService.ensureWorkspace().subscribe({
      error: () => this.addLog(this.now(), 'Could not load workspace', 'error')
    });
  }

  ngAfterViewChecked(): void {
    if (this.hasResults && !this.chartsInitialized) {
      this.initCharts();
      this.chartsInitialized = true;
    }
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.berChart?.destroy();
    this.constellationChart?.destroy();
  }

  // ── Run simulation ────────────────────────────────────────────────────────
  runSimulation(): void {
    const workspaceId = this.wsService.activeWorkspaceId;
    if (!workspaceId) {
      this.addLog(this.now(), 'No workspace found. Please refresh and try again.', 'error');
      return;
    }

    this.isRunning         = true;
    this.hasResults        = false;
    this.chartsInitialized = false;
    this.executionLogs     = [];
    this.berChart?.destroy();
    this.constellationChart?.destroy();

    this.addLog(this.now(), 'Creating simulation configuration...', 'info');

    const schemeId = SCHEME_MAP[this.config.modulationScheme] ?? 'qpsk';

    // Step 1: Create config
    this.simService.createConfig({
      name: `${this.config.modulationScheme} - ${new Date().toLocaleTimeString()}`,
      scheme_id: schemeId,
      workspaceId,
      parameters: {
        snr_min:       this.config.snr_min,
        snr_max:       this.config.snr_max,
        snr_step:      this.config.snr_step,
        num_bits:      this.config.num_bits,
        const_ebn0_db: this.config.snr,
        num_symbols:   this.config.num_symbols,
      }
    }).subscribe({
      next: (res) => {
        this.addLog(this.now(), 'Configuration created, starting simulation...', 'info');
        this.startRun(res.config.config_id, workspaceId);
      },
      error: (err) => {
        this.isRunning = false;
        this.addLog(this.now(), `Failed to create config: ${err.error?.message ?? err.message}`, 'error');
      }
    });
  }

  private startRun(configId: string, workspaceId: string): void {
    // Step 2: Run from config
    this.simService.runFromConfig(configId, workspaceId).subscribe({
      next: (res) => {
        this.currentRunId = res.run._id;
        this.addLog(this.now(), 'Simulation queued, waiting for results...', 'info');
        this.startPolling(this.currentRunId, workspaceId);
      },
      error: (err) => {
        this.isRunning = false;
        this.addLog(this.now(), `Failed to start run: ${err.error?.message ?? err.message}`, 'error');
      }
    });
  }

  private startPolling(runId: string, workspaceId: string): void {
    this.pollSub?.unsubscribe();

    this.pollSub = this.simService.pollStatus(runId, workspaceId).subscribe({
      next: (status: RunStatusResponse) => {
        this.updateLogsFromStatus(status);

        if (status.status === 'completed' && status.results) {
          this.rawResults = status.results;
          this.applyResults(status.results);
          this.isRunning  = false;
          this.hasResults = true;
          this.addLog(this.now(), 'Simulation completed successfully', 'success');
          this.pollSub?.unsubscribe();
        }

        if (status.status === 'failed') {
          this.isRunning = false;
          this.addLog(this.now(), `Simulation failed: ${status.error ?? 'Unknown error'}`, 'error');
          this.pollSub?.unsubscribe();
        }
      },
      error: (err) => {
        this.isRunning = false;
        this.addLog(this.now(), 'Error checking simulation status', 'error');
      }
    });
  }

  private updateLogsFromStatus(status: RunStatusResponse): void {
    if (status.status === 'running' &&
        !this.executionLogs.some(l => l.message.includes('Processing'))) {
      this.addLog(this.now(), `Processing ${this.config.method} iterations`, 'info');
    }
  }

  private applyResults(raw: SimulationResults): void {
    const bits = BITS_PER_SYMBOL[this.config.modulationScheme] ?? 2;

    // overall_ber is the aggregate BER across all SNR points from Octave
    this.results = {
      requiredSnr:        this.config.snr,
      spectralEfficiency: (raw as any).spectral_efficiency ?? bits,
      errorRate:          (raw as any).overall_ber ?? (raw.ber?.[(raw.ber?.length ?? 1) - 1] ?? 0),
      processingTime:     (raw as any).processing_time ?? 0,
    };
  }

  // ── Charts ────────────────────────────────────────────────────────────────
  private initCharts(): void {
    setTimeout(() => {
      this.initBerChart();
      this.initConstellationChart();
    }, 50);
  }

  private initBerChart(): void {
    const canvas = document.getElementById('berChart') as HTMLCanvasElement;
    if (!canvas) return;

    this.berChart?.destroy();

    const raw = this.rawResults;
    // Octave outputs snr_db, not snr_values
    const snrValues = (raw as any)?.snr_db ?? raw?.snr_values ?? Array.from({ length: 21 }, (_, i) => i - 5);
    const berValues = raw?.ber ?? [];

    this.berChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: snrValues.map((v: number) => `${v}`),
        datasets: [{
          label: this.config.modulationScheme,
          data: berValues,
          borderColor: '#22d3ee',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'SNR (dB)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' } },
          y: { type: 'logarithmic', title: { display: true, text: 'Bit Error Rate (BER)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' } }
        },
        plugins: { legend: { labels: { color: '#e6edf3' } } }
      }
    });
  }

  private initConstellationChart(): void {
    const canvas = document.getElementById('constellationChart') as HTMLCanvasElement;
    if (!canvas) return;

    this.constellationChart?.destroy();

    const raw         = this.rawResults;
    const idealPts    = raw?.constellation?.ideal    ?? [];
    const receivedPts = raw?.constellation?.received ?? [];

    const toXY = (pts: { real: number; imag: number }[]) =>
      pts.map(p => ({ x: p.real, y: p.imag }));

    const datasets = [];

    if (receivedPts.length > 0) {
      datasets.push({
        label: 'Received',
        data: toXY(receivedPts),
        backgroundColor: 'rgba(34,211,238,0.6)',
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (idealPts.length > 0) {
      datasets.push({
        label: 'Ideal',
        data: toXY(idealPts),
        backgroundColor: 'rgba(248,113,113,0.8)',
        pointRadius: 6,
        pointHoverRadius: 8
      });
    }

    this.constellationChart = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'In-phase (I)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' }, min: -1.5, max: 1.5 },
          y: { title: { display: true, text: 'Quadrature (Q)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' }, min: -1.5, max: 1.5 }
        },
        plugins: { legend: { labels: { color: '#e6edf3' } } }
      }
    });
  }

  // ── Panel actions ─────────────────────────────────────────────────────────
  onShare():  void { this.closeAllPanels(); this.showSharePanel  = true; }
  onSave():   void { this.closeAllPanels(); this.showSavePanel   = true; this.saveDone = false; this.saveError = ''; }
  onExport(): void { this.closeAllPanels(); this.showExportPanel = true; }

  closeAllPanels(): void {
    this.showSavePanel = false;
    this.showExportPanel = false;
    this.showSharePanel = false;
  }

  // ── Save panel ────────────────────────────────────────────────────────────
  toggleTag(tag: string):       void { const i = this.selectedTags.indexOf(tag); i >= 0 ? this.selectedTags.splice(i, 1) : this.selectedTags.push(tag); }
  isTagSelected(tag: string): boolean { return this.selectedTags.includes(tag); }

  confirmSave(): void {
    const workspaceId = this.wsService.activeWorkspaceId;
    if (!workspaceId) { this.saveError = 'No workspace found.'; return; }

    const schemeId = SCHEME_MAP[this.config.modulationScheme] ?? 'qpsk';

    this.simService.saveConfig({
      name:        this.simulationName,
      description: this.simulationDescription,
      scheme_id:   schemeId,
      workspaceId,
      is_template: false,
      parameters: {
        snr_min:       this.config.snr_min,
        snr_max:       this.config.snr_max,
        snr_step:      this.config.snr_step,
        num_bits:      this.config.num_bits,
        const_ebn0_db: this.config.snr,
        num_symbols:   this.config.num_symbols,
      }
    }).subscribe({
      next: () => {
        this.saveDone = true;
        setTimeout(() => { this.showSavePanel = false; this.saveDone = false; }, 1200);
      },
      error: (err) => {
        this.saveError = err.error?.message ?? 'Failed to save. Try again.';
      }
    });
  }

  // ── Export panel ──────────────────────────────────────────────────────────
  get exportFileName(): string {
    const s   = this.config.modulationScheme.replace('-', '');
    const d   = new Date().toLocaleDateString('en-CA');
    const ext = this.exportFormat === 'png' ? 'zip' : this.exportFormat;
    return `simulation_${s}_${d}.${ext}`;
  }

  confirmExport(): void {
    console.log('Exporting', this.exportFileName);
    this.showExportPanel = false;
  }

  // ── Share panel ───────────────────────────────────────────────────────────
  copyLink(): void {
    navigator.clipboard.writeText(this.shareLink).catch(() => {});
    this.linkCopied = true;
    setTimeout(() => this.linkCopied = false, 2000);
  }

  sendInvite(): void {
    if (!this.inviteEmail) return;
    console.log('Invite sent to', this.inviteEmail);
    this.inviteEmail = '';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private now(): string {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
  }

  private addLog(time: string, message: string, type: 'info' | 'success' | 'error'): void {
    this.executionLogs.push({ time, message, type });
  }
}