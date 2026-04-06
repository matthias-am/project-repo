
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

  // Emits log entries as they arrive so the component can display them. //
  readonly log$ = new Subject<LogEntry>();

  //Emits once when a run completes successfully. 
  readonly result$ = new Subject<RunResult>();

  // Emits once when a run fails. 
  readonly error$ = new Subject<string>();

  //Tracks all accumulated runs across multiple executions in the session. 
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

    const schemeId = SCHEME_MAP[config.modulationScheme] ?? 'qpsk'; //look up value in scheme map, qpsk as fallback
    const modeLabel = isAdaptive ? 'Adaptive' : config.modulationScheme; //display label depending on mode
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
        this.emit('Configuration created, starting simulation...', 'info'); //execution log msg
        this.startRun(res.config.config_id, workspaceId, config, isAdaptive, snrProfile); //starts run using config id from backend
      },
      error: (err) => this.emitError(
        `Failed to create config: ${err.error?.message ?? err.message}`
      ),
    });
  }

  //clear all stored runs
  clearAccumulated(): void {
    this.accumulatedRuns = [];
  }

  // Private helpers 
  private startRun(
    configId: string,
    workspaceId: string,
    config: SimulationConfig,
    isAdaptive: boolean,
    snrProfile: string,
  ): void {
    this.simService.runFromConfig(configId, workspaceId).subscribe({ //calls backend to start sim run, returns observable
      next: (res) => {
        this.emit('Simulation queued, waiting for results...', 'info');

        this.startPolling(res.run._id, configId, workspaceId, config, isAdaptive, snrProfile);
      },
      error: (err) => this.emitError(
        `Failed to start run: ${err.error?.message ?? err.message}`
      ),
    });
  }
  //starts continous status checking
  private startPolling(
    runId: string,
    configId: string,
    workspaceId: string,
    config: SimulationConfig,
    isAdaptive: boolean,
    snrProfile: string,
  ): void {
    this.pollSub?.unsubscribe(); //if already polling stop
    let processingLogged = false; //ensure processing msg only prints once
    let busyMessageLogged = false; //prevents repeating status msgs

    this.pollSub = this.simService.pollStatus(runId, workspaceId).subscribe({ //calls backend repeatedly
      next: (status: RunStatusResponse) => { //on each poll response
        console.log('[poll] runId being polled:', runId, '| status:', status.status, '| has results:', !!status.results)
        if (status.statusMessage && !busyMessageLogged) {
          this.emit(status.statusMessage, 'info'); //display msg from backend
          busyMessageLogged = true; //prevent repeat
        }

        if (status.status !== 'queued') {
          busyMessageLogged = false;
        }

        if (status.status === 'running' && !processingLogged) {
          this.emit(`Processing ${config.method} iterations`, 'info'); //execution log msg
          processingLogged = true;
        }

        if (status.status === 'completed') {

          if (!status.results) { //if completed but no results, return
            return;
          } this.emit('Simulation completed successfully', 'success'); //execution log msg
          const raw = status.results; //extract raw output
          const display = this.buildDisplayResults(raw, config); //converts raw data -> UI-friendly summary
          this.accumulate(raw, config, isAdaptive, snrProfile); //add this run to stored for multicurve
          this.simService.saveResults(configId, raw).subscribe({ //send results to db
            next: () => this.emit('Results saved to library', 'info'),
            error: () => this.emit('Could not save results (non-critical)', 'info'),
          });

          this.result$.next({ raw, display, accumulatedRuns: [...this.accumulatedRuns] }); //emits new data via an observable
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
  //converts raw output into clean UI metrics
  private buildDisplayResults(
    raw: SimulationResults,
    config: SimulationConfig,
  ): DisplayResults {
    const bits = BITS_PER_SYMBOL[config.modulationScheme] ?? 2;
    return {
      requiredSnr: config.snr, //input SNR
      spectralEfficiency: (raw as any).spectral_efficiency ?? bits, //used compute, theoretical as fallbacl
      errorRate: (raw as any).overall_ber
        ?? (raw.ber?.[(raw.ber?.length ?? 1) - 1] ?? 0),
      processingTime: (raw as any).processing_time ?? 0,
    }; //sim time taken
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
    if (ber.length === 0) return; //skip empty results

    const label = isAdaptive
      ? `Adaptive (${snrProfile})`
      : config.modulationScheme;

    const existingIdx = this.accumulatedRuns.findIndex(r => r.label === label); //check if runs with same label already exist
    const color = existingIdx >= 0
      ? this.accumulatedRuns[existingIdx].color
      : RUN_COLORS[this.accumulatedRuns.length % RUN_COLORS.length];

    const entry: AccumulatedRun = { label, color, ber, snr_db }; //create entry

    if (existingIdx >= 0) {
      this.accumulatedRuns[existingIdx] = entry;
    } else {
      this.accumulatedRuns.push(entry);
    }
  } //update existing curve or add new

  private emit(message: string, type: 'info' | 'success' | 'error'): void {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    this.log$.next({ time, message, type });
  }

  private emitError(message: string): void {
    this.emit(message, 'error');
    this.error$.next(message);
  }
}