import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, switchMap, takeWhile } from 'rxjs';

const API = 'http://localhost:5001/api';

export interface CreateConfigPayload {
  name:        string;
  description?: string;
  scheme_id:   string;
  parameters: {
    snr_min:       number;
    snr_max:       number;
    snr_step:      number;
    num_bits:      number;
    const_ebn0_db: number;
    num_symbols:   number;
  };
  workspaceId:   string;
  is_adaptive?:  boolean;
  is_template?:  boolean;
}

export interface ConfigResponse {
  success: boolean;
  config: {
    config_id:    string;
    name:         string;
    scheme_id:    string;
    parameters:   Record<string, any>;
    workspace_id: string;
    owner_id:     string;
    is_template:  boolean;
    is_adaptive:  boolean;
    created_at:   string;
  };
}

export interface RunResponse {
  message: string;
  run: { _id: string };
}

export interface RunStatusResponse {
  success:     boolean;
  status:      'pending' | 'running' | 'completed' | 'failed';
  progress:    number;
  results:     SimulationResults | null;
  error:       string | null;
  startedAt:   string;
  completedAt: string;
}

export interface SimulationResults {
  // Field names exactly as output by adaptive_modulation_sim.m
  ber?:                 number[];
  snr_db?:              number[];      // Octave uses snr_db
  snr_values?:          number[];      // fallback alias
  throughput?:          number[];
  overall_ber?:         number;        // aggregate BER across all SNR points
  avg_throughput?:      number;
  spectral_efficiency?: number;
  used_mod?:            string[];      // which scheme was used at each SNR point
  constellation?: {
    ideal:    { real: number; imag: number }[];
    received: { real: number; imag: number }[];
  };
  processing_time?: number;
}

@Injectable({ providedIn: 'root' })
export class SimulationService {

  constructor(private http: HttpClient) {}

  // POST /api/configs
  createConfig(payload: CreateConfigPayload): Observable<ConfigResponse> {
    return this.http.post<ConfigResponse>(`${API}/configs`, payload);
  }

  // POST /api/configs/:configId/run
  runFromConfig(configId: string, workspaceId: string): Observable<RunResponse> {
    return this.http.post<RunResponse>(
      `${API}/configs/${configId}/run`,
      { workspaceId }
    );
  }

  // GET /api/simulations/:id/status  (workspaceId sent as query param so middleware can find it)
  pollStatus(runId: string, workspaceId: string): Observable<RunStatusResponse> {
    return interval(2000).pipe(
      switchMap(() =>
        this.http.get<RunStatusResponse>(
          `${API}/simulations/${runId}/status`,
          { params: { workspaceId } }
        )
      ),
      takeWhile(
        res => res.status === 'pending' || res.status === 'running',
        true   // emit the terminal value (completed/failed) before stopping
      )
    );
  }

  // for loading saved configs in the library
  getMyConfigs(): Observable<any[]> {
    return this.http.get<any[]>(`${API}/configs/user`);
  }

  //create a named/saved config (Save panel)
  saveConfig(payload: CreateConfigPayload & { is_template: boolean }): Observable<ConfigResponse> {
    return this.http.post<ConfigResponse>(`${API}/configs`, payload);
  }
}