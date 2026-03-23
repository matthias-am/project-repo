import { Component, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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
import { MatMenuModule } from '@angular/material/menu';
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

// Map UI scheme names to backend schemeIds
const SCHEME_MAP: Record<string, string> = {
  'BPSK': 'bpsk',
  'QPSK': 'qpsk',
  '16-QAM': '16qam',
  '64-QAM': '64qam',
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
    MatMenuModule,
    ModulationParameter, SnrInput
  ],
  templateUrl: './simulation.html',
  styleUrl: './simulation.css'
})
export class SimulationComponent implements OnInit, OnDestroy, AfterViewChecked {

  currentUser: ReturnType<Auth['getUser']> = null;

  logout(): void { this.auth.logout(); }

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
  isRunning = false;
  hasResults = false;
  showDecisionBoundaries = true;
  showDistances = false;

  // Multi-scheme BER overlay
  berSchemes = [
    { key: 'simulated', label: 'Simulated', color: '#22d3ee', visible: true, dashed: false },
    { key: 'bpsk', label: 'BPSK', color: '#34d399', visible: false, dashed: true },
    { key: 'qpsk', label: 'QPSK', color: '#818cf8', visible: false, dashed: true },
    { key: '16qam', label: '16-QAM', color: '#f472b6', visible: false, dashed: true },
    { key: '64qam', label: '64-QAM', color: '#fb923c', visible: false, dashed: true },
    { key: '256qam', label: '256-QAM', color: '#facc15', visible: false, dashed: true },
  ];

  // Panel state
  showSavePanel = false;
  showExportPanel = false;

  // Save panel
  simulationName = `QPSK Analysis - ${new Date().toLocaleDateString('en-CA')}`;
  simulationDescription = '';
  availableTags = ['BER Analysis', '4G', '5G', 'High SNR', 'Low SNR', 'QAM', 'PSK', 'Research', 'Teaching', 'Comparison'];
  selectedTags: string[] = [];
  saveDone = false;
  saveError = '';

  // Export panel
  exportFormat: 'json' | 'csv' | 'pdf' | 'png' = 'json';
  exportIncludeParams = true;
  exportIncludeResults = true;
  exportIncludeVisuals = true;

  private berChart: Chart | null = null;
  private constellationChart: Chart | null = null;
  private chartsInitialized = false;
  private pollSub?: Subscription;
  private currentRunId?: string;
  public rawResults?: SimulationResults;

  // Accumulated simulation runs for multi-curve comparison
  accumulatedRuns: { label: string; color: string; ber: number[]; snr_db: number[] }[] = [];
  showAccumulated = true;

  constructor(
    private simService: SimulationService,
    private wsService: WorkspaceService,
    private auth: Auth,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();

    // Load config from library if navigated with state
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state ?? history.state;
    if (state?.loadedConfig) {
      this.applyLoadedConfig(state.loadedConfig);
    }

    this.wsService.ensureWorkspace().subscribe({
      next: (workspaces) => {
        if (workspaces.length > 0) {
          this.addLog(this.now(), 'Workspace loaded, ready to simulate.', 'info');
        } else {
          this.addLog(this.now(), 'No workspace found. Please contact support.', 'error');
        }
      },
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

  // ── Adaptive modulation 
  isAdaptive = false;
  snrProfile: 'linear' | 'sinusoidal' = 'linear';

  // ── Multi-scheme comparison 
  compareSchemes = [
    { key: 'bpsk', label: 'BPSK', selected: false },
    { key: 'qpsk', label: 'QPSK', selected: false },
    { key: '16qam', label: '16-QAM', selected: false },
    { key: '64qam', label: '64-QAM', selected: false },
    { key: '256qam', label: '256-QAM', selected: false },
  ];

  private applyLoadedConfig(cfg: any): void {
    const schemeMap: Record<string, string> = {
      'BPSK': 'BPSK', 'QPSK': 'QPSK',
      '16QAM': '16-QAM', '64QAM': '64-QAM', '256QAM': '256-QAM'
    };
    this.config.modulationScheme = schemeMap[cfg.scheme] ?? cfg.scheme ?? 'QPSK';
    this.config.snr = cfg.snr ?? 10;
    this.config.snr_min = cfg.snr_min ?? 0;
    this.config.snr_max = cfg.snr_max ?? 20;
    this.config.snr_step = cfg.snr_step ?? 2;
    this.config.num_bits = cfg.num_bits ?? 100000;
    this.config.num_symbols = cfg.num_symbols ?? 3000;

    const raw = cfg.raw;
    this.isAdaptive = raw?.is_adaptive ?? cfg.is_adaptive ?? false;
    this.snrProfile = raw?.parameters?.snr_profile ?? cfg.snr_profile ?? 'linear';
    this.config.method = this.isAdaptive ? 'Adaptive' : (cfg.method ?? 'Monte Carlo');

    this.addLog(this.now(), `Loaded config: ${cfg.name}`, 'success');
  }

  // ── Run simulation 
  runSimulation(): void {
    const workspaceId = this.wsService.activeWorkspaceId;
    if (!workspaceId) {
      this.addLog(this.now(), 'No workspace found. Please refresh and try again.', 'error');
      return;
    }

    this.isRunning = true;
    this.hasResults = false;
    this.chartsInitialized = false;
    this.executionLogs = [];
    this.berChart?.destroy();
    this.constellationChart?.destroy();

    this.addLog(this.now(), 'Creating simulation configuration...', 'info');

    const schemeId = SCHEME_MAP[this.config.modulationScheme] ?? 'qpsk';
    const selectedCompare = this.compareSchemes.filter(s => s.selected).map(s => s.key);
    const modeLabel = this.isAdaptive ? 'Adaptive' : this.config.modulationScheme;

    // Step 1: Create config
    this.simService.createConfig({
      name: `${modeLabel} - ${new Date().toLocaleTimeString()}`,
      scheme_id: schemeId,
      workspaceId,
      is_adaptive: this.isAdaptive,
      parameters: {
        schemeId,
        snr_min: this.config.snr_min,
        snr_max: this.config.snr_max,
        snr_step: this.config.snr_step,
        num_bits: this.config.num_bits,
        const_ebn0_db: this.config.snr,
        num_symbols: this.config.num_symbols,
        is_adaptive: this.isAdaptive,
        snr_profile: this.snrProfile,
        compare_schemes: selectedCompare,
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
          this.isRunning = false;
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

    this.results = {
      requiredSnr: this.config.snr,
      spectralEfficiency: (raw as any).spectral_efficiency ?? bits,
      errorRate: (raw as any).overall_ber ?? (raw.ber?.[(raw.ber?.length ?? 1) - 1] ?? 0),
      processingTime: (raw as any).processing_time ?? 0,
    };

    // Accumulate this run for multi-curve comparison
    const snrDb = (raw as any).snr_db ?? (raw as any).snr_values ?? [];
    const ber = raw.ber ?? [];
    if (ber.length > 0) {
      const runColors = ['#22d3ee', '#34d399', '#f59e0b', '#f87171', '#818cf8', '#fb923c', '#c084fc'];
      const label = this.isAdaptive
        ? `Adaptive (${this.snrProfile})`
        : this.config.modulationScheme;
      // Check if same label already exists — update it instead of duplicating
      const existingIdx = this.accumulatedRuns.findIndex(r => r.label === label);
      const color = runColors[this.accumulatedRuns.length % runColors.length];
      if (existingIdx >= 0) {
        this.accumulatedRuns[existingIdx] = { label, color: this.accumulatedRuns[existingIdx].color, ber, snr_db: snrDb };
      } else {
        this.accumulatedRuns.push({ label, color, ber, snr_db: snrDb });
      }
    }
  }

  getAdaptiveSchemes(): { scheme: string; snr_range: string }[] {
    const raw = this.rawResults as any;
    if (!raw?.used_mod || !raw?.snr_db) return [];
    const result: { scheme: string; snr_range: string }[] = [];
    let currentScheme = raw.used_mod[0];
    let startSnr = raw.snr_db[0];
    for (let i = 1; i < raw.used_mod.length; i++) {
      if (raw.used_mod[i] !== currentScheme || i === raw.used_mod.length - 1) {
        result.push({
          scheme: currentScheme,
          snr_range: `${startSnr.toFixed(0)}–${raw.snr_db[i - 1].toFixed(0)} dB`
        });
        currentScheme = raw.used_mod[i];
        startSnr = raw.snr_db[i];
      }
    }
    return result;
  }

  clearAccumulated(): void {
    this.accumulatedRuns = [];
    if (this.hasResults) this.initBerChart();
  }

  // ── Charts 
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

    const raw = this.rawResults as any;
    const snrValues = raw?.snr_db ?? raw?.snr_values ?? Array.from({ length: 21 }, (_, i) => i - 5);
    const datasets: any[] = [];

    // ── Accumulated simulated runs 
    for (const run of this.accumulatedRuns) {
      const snr = run.snr_db.length > 0 ? run.snr_db : snrValues;
      datasets.push({
        label: `${run.label} (Simulated)`,
        data: run.ber,
        borderColor: run.color,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
        borderDash: []
      });
    }

    // ── Theoretical overlays toggled by user ───────────────────────────────
    for (const scheme of this.berSchemes) {
      if (!scheme.visible || scheme.key === 'simulated') continue;
      const theoreticalData = snrValues.map((s: number) => this.theoreticalBer(scheme.key, s));
      datasets.push({
        label: `${scheme.label} (Theoretical)`,
        data: theoreticalData,
        borderColor: scheme.color,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        borderDash: [6, 3]
      });
    }

    this.berChart = new Chart(canvas, {
      type: 'line',
      data: { labels: snrValues.map((v: number) => `${v}`), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'SNR (dB)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' } },
          y: { type: 'logarithmic', title: { display: true, text: 'Bit Error Rate (BER)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' } }
        },
        plugins: { legend: { labels: { color: '#e6edf3', usePointStyle: true } } }
      }
    });
  }

  private initConstellationChart(): void {
    const canvas = document.getElementById('constellationChart') as HTMLCanvasElement;
    if (!canvas) return;

    this.constellationChart?.destroy();

    const raw = this.rawResults;
    const idealPts = raw?.constellation?.ideal ?? [];
    const receivedPts = raw?.constellation?.received ?? [];

    const toXY = (pts: { real: number; imag: number }[]) =>
      pts.map(p => ({ x: p.real, y: p.imag }));

    const idealXY = toXY(idealPts);
    const receivedXY = toXY(receivedPts);

    // Find nearest ideal point for each received point
    const findNearest = (pt: { x: number, y: number }, ideals: { x: number, y: number }[]) => {
      let best = ideals[0];
      let bestDist = Infinity;
      for (const ip of ideals) {
        const d = Math.sqrt((pt.x - ip.x) ** 2 + (pt.y - ip.y) ** 2);
        if (d < bestDist) { bestDist = d; best = ip; }
      }
      return best;
    };

    // Custom plugin to draw distance lines and decision boundaries
    const constellationPlugin = {
      id: 'constellationOverlay',
      afterDatasetsDraw: (chart: any) => {
        const ctx = chart.ctx;
        const xScale = chart.scales['x'];
        const yScale = chart.scales['y'];

        // Draw distance lines
        if (this.showDistances && idealXY.length > 0 && receivedXY.length > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(251,191,36,0.4)';
          ctx.lineWidth = 1;
          for (const rpt of receivedXY) {
            const nearest = findNearest(rpt, idealXY);
            ctx.beginPath();
            ctx.moveTo(xScale.getPixelForValue(rpt.x), yScale.getPixelForValue(rpt.y));
            ctx.lineTo(xScale.getPixelForValue(nearest.x), yScale.getPixelForValue(nearest.y));
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw decision boundaries (axes through origin)
        if (this.showDecisionBoundaries) {
          ctx.save();
          ctx.strokeStyle = 'rgba(248,113,113,0.5)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);

          // Vertical boundary at x=0
          const xMid = xScale.getPixelForValue(0);
          ctx.beginPath();
          ctx.moveTo(xMid, chart.chartArea.top);
          ctx.lineTo(xMid, chart.chartArea.bottom);
          ctx.stroke();

          // Horizontal boundary at y=0
          const yMid = yScale.getPixelForValue(0);
          ctx.beginPath();
          ctx.moveTo(chart.chartArea.left, yMid);
          ctx.lineTo(chart.chartArea.right, yMid);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    };

    const datasets: any[] = [];

    if (receivedXY.length > 0) {
      datasets.push({
        label: 'Received',
        data: receivedXY,
        backgroundColor: 'rgba(34,211,238,0.6)',
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (idealXY.length > 0) {
      datasets.push({
        label: 'Ideal',
        data: idealXY,
        backgroundColor: 'rgba(248,113,113,0.9)',
        pointRadius: 7,
        pointHoverRadius: 9
      });
    }

    this.constellationChart = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { title: { display: true, text: 'In-phase (I)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' }, min: -1.5, max: 1.5 },
          y: { title: { display: true, text: 'Quadrature (Q)', color: '#7d8590' }, ticks: { color: '#7d8590' }, grid: { color: 'rgba(125,133,144,0.15)' }, min: -1.5, max: 1.5 }
        },
        plugins: { legend: { labels: { color: '#e6edf3' } } }
      },
      plugins: [constellationPlugin]
    });
  }

  // Re-render constellation when toggles change
  onDecisionBoundariesChange(): void {
    if (this.hasResults) this.initConstellationChart();
  }

  onShowDistancesChange(): void {
    if (this.hasResults) this.initConstellationChart();
  }

  toggleBerScheme(key: string): void {
    const scheme = this.berSchemes.find(s => s.key === key);
    if (scheme) {
      scheme.visible = !scheme.visible;
      if (this.hasResults) this.initBerChart();
    }
  }

  memberColor(username: string): string {
    const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#34d399', '#facc15'];
    let hash = 0;
    for (const c of username) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  // Theoretical BER formulas
  private theoreticalBer(scheme: string, snrDb: number): number {
    const snr = Math.pow(10, snrDb / 10);
    const erfc = (x: number) => {
      const t = 1 / (1 + 0.3275911 * x);
      return t * Math.exp(-x * x) * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    };
    const qfunc = (x: number) => 0.5 * erfc(x / Math.SQRT2);
    switch (scheme) {
      case 'bpsk': return qfunc(Math.sqrt(2 * snr));
      case 'qpsk': return qfunc(Math.sqrt(2 * snr));
      case '16qam': return (3 / 8) * erfc(Math.sqrt(snr / 10));
      case '64qam': return (7 / 24) * erfc(Math.sqrt(snr / 42));
      case '256qam': return (15 / 64) * erfc(Math.sqrt(snr / 170));
      default: return 0.5;
    }
  }

  // ── Panel actions 
  onSave(): void {
    this.closeAllPanels();
    this.showSavePanel = true;
    this.saveDone = false;
    this.saveError = '';
    this.simulationName = `${this.config.modulationScheme} Analysis - ${new Date().toLocaleDateString('en-CA')}`;
  }
  onExport(): void { this.closeAllPanels(); this.showExportPanel = true; }

  closeAllPanels(): void {
    this.showSavePanel = false;
    this.showExportPanel = false;
  }

  // ── Save panel 
  toggleTag(tag: string): void { const i = this.selectedTags.indexOf(tag); i >= 0 ? this.selectedTags.splice(i, 1) : this.selectedTags.push(tag); }
  isTagSelected(tag: string): boolean { return this.selectedTags.includes(tag); }

  confirmSave(): void {
    const workspaceId = this.wsService.activeWorkspaceId;
    if (!workspaceId) { this.saveError = 'No workspace found.'; return; }

    const schemeId = SCHEME_MAP[this.config.modulationScheme] ?? 'qpsk';

    this.simService.saveConfig({
      name: this.simulationName,
      description: this.simulationDescription,
      scheme_id: schemeId,
      workspaceId,
      is_template: false,
      parameters: {
        schemeId,
        snr_min: this.config.snr_min,
        snr_max: this.config.snr_max,
        snr_step: this.config.snr_step,
        num_bits: this.config.num_bits,
        const_ebn0_db: this.config.snr,
        num_symbols: this.config.num_symbols,
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

  // ── Export panel 
  get exportFileName(): string {
    const s = this.config.modulationScheme.replace('-', '');
    const d = new Date().toLocaleDateString('en-CA');
    const ext = this.exportFormat === 'png' ? 'zip' : this.exportFormat;
    return `simulation_${s}_${d}.${ext}`;
  }

  confirmExport(): void {
    const raw = this.rawResults as any;
    const snrValues = raw?.snr_db ?? raw?.snr_values ?? [];

    const exportData = {
      simulation: {
        modulation: this.config.modulationScheme,
        snr_db: this.config.snr,
        awgn: this.config.awgn,
        interference: this.config.interference,
        method: this.config.method,
        date: new Date().toISOString(),
      },
      results: this.exportIncludeResults ? {
        ber: raw?.ber ?? [],
        snr_values: snrValues,
        overall_ber: raw?.overall_ber ?? null,
        spectral_efficiency: raw?.spectral_efficiency ?? null,
        avg_throughput: raw?.avg_throughput ?? null,
      } : undefined,
      constellation: (this.exportIncludeVisuals && raw?.constellation) ? raw.constellation : undefined,
    };

    let content = '';
    let mimeType = 'application/json';
    const fname = this.exportFileName;

    if (this.exportFormat === 'json') {
      content = JSON.stringify(exportData, null, 2);
      mimeType = 'application/json';
    } else if (this.exportFormat === 'csv') {
      const rows = ['SNR_dB,BER'];
      snrValues.forEach((s: number, i: number) => {
        rows.push(`${s},${raw?.ber?.[i] ?? ''}`);
      });
      content = rows.join('\n');
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
    this.showExportPanel = false;
  }

  // ── Helpers 
  private now(): string {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
  }

  private addLog(time: string, message: string, type: 'info' | 'success' | 'error'): void {
    this.executionLogs.push({ time, message, type });
  }
}