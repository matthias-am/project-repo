
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import {
  SimulationService,
  SimulationResults,
  RunStatusResponse,
} from '../../services/sim-services/simulation.service';
import { WorkspaceService } from '../../services/workspace service/workspace.service';
import {
  SimulationConfig,
  DisplayResults,
  LogEntry,
  AccumulatedRun,
  SCHEME_MAP,
  BITS_PER_SYMBOL,
  RUN_COLORS,
} from '../../components/simulation/sim-types/simulation.types';

export interface RunEvent {
  type: 'log';
  entry: LogEntry;
}

export interface RunResult {
  raw: SimulationResults;
  display: DisplayResults;
  accumulatedRuns: AccumulatedRun[];
}

@Injectable({ providedIn: 'root' })
export class SimulationRunService implements OnDestroy {

  /** Emits log entries as they arrive so the component can display them. */
  readonly log$ = new Subject<LogEntry>();

  /** Emits once when a run completes successfully. */
  readonly result$ = new Subject<RunResult>();

  /** Emits once when a run fails. */
  readonly error$ = new Subject<string>();

  /** Tracks all accumulated runs across multiple executions in the session. */
  accumulatedRuns: AccumulatedRun[] = [];

  private pollSub?: Subscription;

  constructor(
    private simService: SimulationService,
    private wsService: WorkspaceService,
  ) { }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  // ── Public API 
  // Kicks off a full simulation run for the given config.

  run(config: SimulationConfig, isAdaptive: boolean, snrProfile: string): void {

    // Cancel any existing poll before starting a new run
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    const workspaceId = this.wsService.activeWorkspaceId;
    if (!workspaceId) {
      this.emitError('No workspace found. Please refresh and try again.');
      return;
    }

    const schemeId = SCHEME_MAP[config.modulationScheme] ?? 'qpsk';
    const modeLabel = isAdaptive ? 'Adaptive' : config.modulationScheme;
    const selectedCompare: string[] = []; // populated from component if needed

    this.emit('Creating simulation configuration...', 'info');

    //create the config
    this.simService.createConfig({
      name: `${modeLabel} - ${new Date().toLocaleTimeString()}`,
      scheme_id: schemeId,
      workspaceId,
      is_adaptive: isAdaptive,
      parameters: {
        schemeId,
        snr_min: config.snr_min,
        snr_max: config.snr_max,
        snr_step: config.snr_step,
        num_bits: config.num_bits,
        const_ebn0_db: config.snr,
        num_symbols: config.num_symbols,
        is_adaptive: isAdaptive,
        snr_profile: snrProfile,
        compare_schemes: selectedCompare,

        // ── AWGN  and interference are passed here so Octave can use them
        awgn_variance: config.awgn,
        interference_power: config.interference,
        symbol_rate: 1_000_000,
      },
    }).subscribe({
      next: (res) => {
        this.emit('Configuration created, starting simulation...', 'info');
        this.startRun(res.config.config_id, workspaceId, config, isAdaptive, snrProfile);
      },
      error: (err) => this.emitError(
        `Failed to create config: ${err.error?.message ?? err.message}`
      ),
    });
  }

  clearAccumulated(): void {
    this.accumulatedRuns = [];
  }

  // ── Private helpers 
  private startRun(
    configId: string,
    workspaceId: string,
    config: SimulationConfig,
    isAdaptive: boolean,
    snrProfile: string,
  ): void {
    this.simService.runFromConfig(configId, workspaceId).subscribe({
      next: (res) => {
        this.emit('Simulation queued, waiting for results...', 'info');

        this.startPolling(res.run._id, configId, workspaceId, config, isAdaptive, snrProfile);
      },
      error: (err) => this.emitError(
        `Failed to start run: ${err.error?.message ?? err.message}`
      ),
    });
  }

  private startPolling(
    runId: string,
    configId: string,
    workspaceId: string,
    config: SimulationConfig,
    isAdaptive: boolean,
    snrProfile: string,
  ): void {
    this.pollSub?.unsubscribe();
    let processingLogged = false;
    let busyMessageLogged = false;

    this.pollSub = this.simService.pollStatus(runId, workspaceId).subscribe({
      next: (status: RunStatusResponse) => {
        console.log('[poll] runId being polled:', runId, '| status:', status.status, '| has results:', !!status.results)
        if (status.statusMessage && !busyMessageLogged) {
          this.emit(status.statusMessage, 'info');
          busyMessageLogged = true;
        }

        if (status.status !== 'queued') {
          busyMessageLogged = false;
        }

        if (status.status === 'running' && !processingLogged) {
          this.emit(`Processing ${config.method} iterations`, 'info');
          processingLogged = true;
        }

        if (status.status === 'completed') {

          if (!status.results) {
            return;
          } this.emit('Simulation completed successfully', 'success');
          const raw = status.results;
          const display = this.buildDisplayResults(raw, config);
          this.accumulate(raw, config, isAdaptive, snrProfile);
          this.simService.saveResults(configId, raw).subscribe({
            next: () => this.emit('Results saved to library', 'info'),
            error: () => this.emit('Could not save results (non-critical)', 'info'),
          });

          this.result$.next({ raw, display, accumulatedRuns: [...this.accumulatedRuns] });
          this.pollSub?.unsubscribe();
        }

        if (status.status === 'failed') {
          this.emitError(`Simulation failed: ${status.error ?? 'Unknown error'}`);
          this.pollSub?.unsubscribe();
        }
      },
      error: () => this.emitError('Error checking simulation status'),
    });
  }

  private buildDisplayResults(
    raw: SimulationResults,
    config: SimulationConfig,
  ): DisplayResults {
    const bits = BITS_PER_SYMBOL[config.modulationScheme] ?? 2;
    return {
      requiredSnr: config.snr,
      spectralEfficiency: (raw as any).spectral_efficiency ?? bits,
      errorRate: (raw as any).overall_ber
        ?? (raw.ber?.[(raw.ber?.length ?? 1) - 1] ?? 0),
      processingTime: (raw as any).processing_time ?? 0,
    };
  }

  // Adds (or updates) an entry in accumulatedRuns for multi-curve BER display.

  private accumulate(
    raw: SimulationResults,
    config: SimulationConfig,
    isAdaptive: boolean,
    snrProfile: string,
  ): void {
    const snr_db: number[] = (raw as any).snr_db ?? (raw as any).snr_values ?? [];
    const ber: number[] = raw.ber ?? [];
    if (ber.length === 0) return;

    const label = isAdaptive
      ? `Adaptive (${snrProfile})`
      : config.modulationScheme;

    const existingIdx = this.accumulatedRuns.findIndex(r => r.label === label);
    const color = existingIdx >= 0
      ? this.accumulatedRuns[existingIdx].color
      : RUN_COLORS[this.accumulatedRuns.length % RUN_COLORS.length];

    const entry: AccumulatedRun = { label, color, ber, snr_db };

    if (existingIdx >= 0) {
      this.accumulatedRuns[existingIdx] = entry;
    } else {
      this.accumulatedRuns.push(entry);
    }
  }

  private emit(message: string, type: 'info' | 'success' | 'error'): void {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    this.log$.next({ time, message, type });
  }

  private emitError(message: string): void {
    this.emit(message, 'error');
    this.error$.next(message);
  }
}