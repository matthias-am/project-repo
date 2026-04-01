

import {
  Component, OnInit, OnDestroy, AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

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
import { Chart } from 'chart.js'; //CHARTS!

import { ModulationParameter } from './modulation-parameter/modulation-parameter';
import { SnrInput } from './snr-input/snr-input';
import { SimulationResults } from '../../services/sim-services/simulation.service';
import { WorkspaceService } from '../../services/workspace service/workspace.service';
import { Auth } from '../../services/auth-services/auth';
import { SimulationService } from '../../services/sim-services/simulation.service';
import { SimulationRunService } from '../../services/sim-services/simulation.run.service';
import { SimulationChartsService } from '../../services/sim-services/simulation-charts.service'; //CHARTS!
import {
  exportAndDownload,
  buildExportFileName,
  ExportFormat,
} from '../../services/sim-services/simulation.export.service';
import {
  SimulationConfig,
  DisplayResults,
  LogEntry,
  BerScheme,
  CompareScheme,
  SCHEME_MAP,
  DEFAULT_BER_SCHEMES,
  DEFAULT_COMPARE_SCHEMES,
} from '../simulation/sim-types/simulation.types';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatToolbarModule, MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSlideToggleModule, MatDividerModule, MatInputModule,
    MatChipsModule, MatMenuModule,
    ModulationParameter, SnrInput,
  ],
  templateUrl: './simulation.html',
  styleUrl: './simulation.css',
})
export class SimulationComponent implements OnInit, OnDestroy, AfterViewChecked {

  // ── Auth 
  currentUser: ReturnType<Auth['getUser']> = null;
  logout(): void { this.auth.logout(); }

  // ── Simulation config 
  config: SimulationConfig = {
    modulationScheme: 'QPSK',
    snr: 10,
    awgn: 0,
    interference: 0.,
    method: 'Monte Carlo',
    snr_min: 0,
    snr_max: 20,
    snr_step: 2,
    num_bits: 100000,
    num_symbols: 3000,
  };

  // ── Results & logs 
  results: DisplayResults = {
    requiredSnr: 0, spectralEfficiency: 0, errorRate: 0, processingTime: 0,
  };
  executionLogs: LogEntry[] = [];
  isRunning = false;
  hasResults = false;
  public rawResults?: SimulationResults;

  // ── Chart toggle state 
  showDecisionBoundaries = true;
  showDistances = false;

  // ── Adaptive modulation 
  isAdaptive = false;
  snrProfile: 'linear' | 'sinusoidal' = 'linear';

  // ── Multi-scheme BER overlays 
  berSchemes: BerScheme[] = DEFAULT_BER_SCHEMES.map(s => ({ ...s }));
  compareSchemes: CompareScheme[] = DEFAULT_COMPARE_SCHEMES.map(s => ({ ...s }));

  // ── Accumulated runs (multi-curve comparison) 
  get accumulatedRuns() { return this.runService.accumulatedRuns; }

  // ── Save panel 
  showSavePanel = false;
  simulationName = `QPSK Analysis - ${new Date().toLocaleDateString('en-CA')}`;
  simulationDescription = '';
  availableTags = [
    'BER Analysis', '4G', '5G', 'High SNR', 'Low SNR',
    'QAM', 'PSK', 'Research', 'Teaching', 'Comparison',
  ];
  selectedTags: string[] = [];
  saveDone = false;
  saveError = '';

  // ── Export panel 
  showExportPanel = false;
  exportFormat: ExportFormat = 'json';
  exportIncludeParams = true;
  exportIncludeResults = true;
  exportIncludeVisuals = true;
  get exportFileName(): string {
    return buildExportFileName(this.config.modulationScheme, this.exportFormat);
  }

  // ── Private chart handles 
  private berChart: Chart | null = null;
  private constellationChart: Chart | null = null;
  private chartsInitialized = false;
  private subs = new Subscription();

  constructor(
    private runService: SimulationRunService,
    private chartService: SimulationChartsService,
    private wsService: WorkspaceService,
    private simService: SimulationService,
    private auth: Auth,
    private router: Router,
  ) { }

  // ── Lifecycle 

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();

    // Load config injected from the Library page
    const state = this.router.getCurrentNavigation()?.extras?.state ?? history.state;
    if (state?.loadedConfig) this.applyLoadedConfig(state.loadedConfig);

    this.wsService.ensureWorkspace().subscribe({
      next: (ws) => this.addLog(
        ws.length > 0
          ? 'Workspace loaded, ready to simulate.'
          : 'No workspace found. Please contact support.',
        ws.length > 0 ? 'info' : 'error',
      ),
      error: () => this.addLog('Could not load workspace', 'error'),
    });

    // Wire up run service streams
    this.subs.add(
      this.runService.log$.subscribe(e => this.executionLogs.push(e)),
    );
    this.subs.add(
      this.runService.result$.subscribe(({ raw, display, accumulatedRuns: _ }) => {
        this.rawResults = raw;
        this.results = display;
        this.isRunning = false;
        this.hasResults = true;
        this.chartsInitialized = false; // trigger AfterViewChecked re-render
      }),
    );
    this.subs.add(
      this.runService.error$.subscribe(() => { this.isRunning = false; }),
    );
  }

  ngAfterViewChecked(): void {
    if (this.hasResults && !this.chartsInitialized) {
      this.initCharts();
      this.chartsInitialized = true;
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.berChart?.destroy();
    this.constellationChart?.destroy();
  }

  // ── Simulation trigger 
  runSimulation(): void {
    console.log('config.snr:', this.config.snr, 'config.awgn:', this.config.awgn, 'config.interference:', this.config.interference);
    this.isRunning = false; // reset first
    this.hasResults = false;
    this.chartsInitialized = false;
    this.executionLogs = [];
    this.berChart?.destroy();
    this.constellationChart?.destroy();
    this.isRunning = true;

    // Sync compareSchemes → berSchemes visibility
    for (const cs of this.compareSchemes) {
      const bs = this.berSchemes.find(s => s.key === cs.key);
      if (bs) bs.visible = cs.selected;
    }

    this.runService.run(this.config, this.isAdaptive, this.snrProfile);
  }

  // ── Chart actions 
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

  clearAccumulated(): void {
    this.runService.clearAccumulated();
    if (this.hasResults) this.initBerChart();
  }

  resetZoom(): void {
    (this.berChart as any)?.resetZoom?.();
  }

  // ── Adaptive scheme label helper 

  getAdaptiveSchemes(): { scheme: string; snr_range: string }[] {
    const raw = this.rawResults as any;
    if (!raw?.used_mod || !raw?.snr_db) return [];
    const result: { scheme: string; snr_range: string }[] = [];
    let current = raw.used_mod[0];
    let start = raw.snr_db[0];
    for (let i = 1; i < raw.used_mod.length; i++) {
      if (raw.used_mod[i] !== current || i === raw.used_mod.length - 1) {
        result.push({
          scheme: current,
          snr_range: `${start.toFixed(0)}–${raw.snr_db[i - 1].toFixed(0)} dB`,
        });
        current = raw.used_mod[i];
        start = raw.snr_db[i];
      }
    }
    return result;
  }

  // ── Panel actions

  onSave(): void {
    this.closeAllPanels();
    this.showSavePanel = true;
    this.saveDone = false;
    this.saveError = '';
    this.simulationName =
      `${this.config.modulationScheme} Analysis - ${new Date().toLocaleDateString('en-CA')}`;
  }

  onExport(): void { this.closeAllPanels(); this.showExportPanel = true; }
  closeAllPanels(): void { this.showSavePanel = false; this.showExportPanel = false; }

  // ── Save 

  toggleTag(tag: string): void {
    const i = this.selectedTags.indexOf(tag);
    i >= 0 ? this.selectedTags.splice(i, 1) : this.selectedTags.push(tag);
  }
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
        awgn_variance: this.config.awgn ?? 0.5,
        interference_power: this.config.interference ?? 0.1,
        is_adaptive: this.config.is_adaptive ?? false,
        snr_profile: this.config.snr_profile ?? 'linear',
        symbol_rate: 1_000_000,


      },
    }).subscribe({
      next: (res) => {
        if (this.rawResults && res.config?.config_id) {
          this.simService.saveResults(res.config.config_id, this.rawResults).subscribe();
        }
        this.saveDone = true;
        setTimeout(() => { this.showSavePanel = false; this.saveDone = false; }, 1200);
      },
      error: (err) => { this.saveError = err.error?.message ?? 'Failed to save. Try again.'; },
    });
  }

  // ── Export 

  confirmExport(): void {
    exportAndDownload(this.config, this.rawResults, {
      format: this.exportFormat,
      includeParams: this.exportIncludeParams,
      includeResults: this.exportIncludeResults,
      includeVisuals: this.exportIncludeVisuals,
    });
    this.showExportPanel = false;
  }

  // ── Private helpers ─

  private initCharts(): void {
    setTimeout(() => {
      this.initBerChart();
      this.initConstellationChart();
    }, 50);
  }

  private initBerChart(): void {
    const canvas = document.getElementById('berChart') as HTMLCanvasElement;
    if (!canvas) return;
    this.berChart = this.chartService.initBerChart(
      canvas, this.berChart, this.rawResults,
      this.accumulatedRuns, this.berSchemes,
    );
  }

  private initConstellationChart(): void {
    const canvas = document.getElementById('constellationChart') as HTMLCanvasElement;
    if (!canvas) return;
    this.constellationChart = this.chartService.initConstellationChart(
      canvas, this.constellationChart, this.rawResults,
      this.showDecisionBoundaries, this.showDistances,
    );
  }

  private applyLoadedConfig(cfg: any): void {
    const schemeMap: Record<string, string> = {
      'BPSK': 'BPSK', 'QPSK': 'QPSK',
      '16QAM': '16-QAM', '64QAM': '64-QAM', '256QAM': '256-QAM',
      '1024QAM': '1024-QAM',
    };
    this.config.modulationScheme = schemeMap[cfg.scheme] ?? cfg.scheme ?? 'QPSK';
    this.config.snr = cfg.snr ?? 10;
    this.config.snr_min = cfg.snr_min ?? 0;
    this.config.snr_max = cfg.snr_max ?? 20;
    this.config.snr_step = cfg.snr_step ?? 2;
    this.config.num_bits = cfg.num_bits ?? 100000;
    this.config.num_symbols = cfg.num_symbols ?? 3000;
    this.config.awgn = cfg.awgn ?? cfg.raw?.parameters?.awgn_variance ?? 0;
    this.config.interference = cfg.interference ?? cfg.raw?.parameters?.interference_power ?? 0;
    this.isAdaptive = cfg.raw?.is_adaptive ?? cfg.is_adaptive ?? false;
    this.snrProfile = cfg.raw?.parameters?.snr_profile ?? cfg.snr_profile ?? 'linear';
    this.config.method = this.isAdaptive ? 'Adaptive' : (cfg.method ?? 'Monte Carlo');
    this.addLog(`Loaded config: ${cfg.name}`, 'success');
  }

  private addLog(message: string, type: 'info' | 'success' | 'error'): void {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    this.executionLogs.push({ time, message, type });
  }
}