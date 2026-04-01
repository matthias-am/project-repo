import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth-services/auth';
import { SimulationService, SimulationResults } from '../../services/sim-services/simulation.service';

export interface SimulationEntry {
  id: string;
  name: string;
  scheme: string;
  date: string;
  status: 'completed' | 'failed' | 'running';
  starred: boolean;
  snr: number;
  snr_min: number;
  snr_max: number;
  snr_step: number;
  num_bits: number;
  num_symbols: number;
  method: string;
  description: string;
  is_adaptive: boolean;
  snr_profile: string;
  awgn: number;
  interference: number;
  owner_id: string;
  results: SimulationResults | null;
  raw: any;
}

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    MatIconModule, MatButtonModule, MatToolbarModule,
    MatRippleModule, MatMenuModule, MatProgressSpinnerModule,
    MatDividerModule
  ],
  templateUrl: './library.html',
  styleUrl: './library.css'
})
export class LibraryComponent implements OnInit {

  searchQuery = '';
  activeFilter = 'All';
  isLoading = true;
  errorMsg = '';
  filters = ['All', 'BPSK', 'QPSK', '16QAM', '64QAM', '256QAM'];
  simulations: SimulationEntry[] = [];
  currentUser: ReturnType<Auth['getUser']> = null;

  // Detail panel
  selectedSim: SimulationEntry | null = null;
  showDetail = false;

  constructor(
    //private http: HttpClient,
    private simService: SimulationService,
    private auth: Auth,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.isLoading = true;
    this.errorMsg = '';
    //this.http.get<any[]>('http://localhost:5001/api/configs/user').subscribe({
    this.simService.getMyConfigs().subscribe({
      next: (configs) => {
        this.simulations = configs.map(c => ({
          id: c.config_id ?? c._id,
          name: c.name,
          scheme: this.normalizeScheme(c.scheme_id),
          date: new Date(c.created_at).toLocaleDateString('en-CA'),
          status: 'completed' as const,
          starred: false,
          snr: c.parameters?.const_ebn0_db ?? 10,
          snr_min: c.parameters?.snr_min ?? 0,
          snr_max: c.parameters?.snr_max ?? 20,
          snr_step: c.parameters?.snr_step ?? 2,
          num_bits: c.parameters?.num_bits ?? 100000,
          num_symbols: c.parameters?.num_symbols ?? 3000,
          method: c.parameters?.method ?? 'Monte Carlo',
          description: c.description ?? '',
          is_adaptive: c.is_adaptive ?? false,
          snr_profile: c.parameters?.snr_profile ?? 'linear',
          awgn: c.parameters?.awgn_variance ?? 1,
          interference: c.parameters?.interference_power ?? 0,
          owner_id: c.owner_id,
          results: c.results ?? null,
          raw: c
        }));
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'Failed to load simulations.';
        this.isLoading = false;
      }
    });
  }

  openDetail(sim: SimulationEntry): void {
    this.selectedSim = sim;
    this.showDetail = true;
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedSim = null;
  }

  loadIntoSimulator(): void {
    if (!this.selectedSim) return;
    this.router.navigate(['/simulation'], {
      state: { loadedConfig: this.selectedSim }
    });
  }

  private normalizeScheme(schemeId: string): string {
    const map: Record<string, string> = {
      'bpsk': 'BPSK', 'qpsk': 'QPSK',
      '16qam': '16QAM', '64qam': '64QAM',
      '256qam': '256QAM', '1024qam': '1024QAM'
    };
    return map[schemeId?.toLowerCase()] ?? schemeId?.toUpperCase() ?? 'QPSK';
  }

  get filtered(): SimulationEntry[] {
    return this.simulations.filter(s => {
      const matchesFilter = this.activeFilter === 'All' || s.scheme === this.activeFilter;
      const matchesSearch = s.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }

  toggleStar(sim: SimulationEntry, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    sim.starred = !sim.starred;
  }

  setFilter(filter: string): void { this.activeFilter = filter; }
  logout(): void { this.auth.logout(); }

  schemeColor(scheme: string): string {
    const map: Record<string, string> = {
      'BPSK': '#22d3ee', 'QPSK': '#818cf8',
      '16QAM': '#34d399', '64QAM': '#f59e0b',
      '256QAM': '#f87171', '1024QAM': '#c084fc'
    };
    return map[scheme] ?? '#7d8590';
  }
  // ── Results helpers ───────────────────────────────────────────────────────────

  getBerAtSnr(sim: SimulationEntry): string {
    const results = sim.results as any;
    if (!results?.ber || !results?.snr_db) return 'N/A';
    const snrArr: number[] = results.snr_db;
    const berArr: number[] = results.ber;
    // Find the index closest to the saved SNR point
    const idx = snrArr.reduce((best, val, i) =>
      Math.abs(val - sim.snr) < Math.abs(snrArr[best] - sim.snr) ? i : best, 0);
    return berArr[idx] !== undefined ? berArr[idx].toExponential(3) : 'N/A';
  }

  getEvm(sim: SimulationEntry): string {
    const results = sim.results as any;
    const ideal: { real: number; imag: number }[] = results?.constellation?.ideal;
    const received: { real: number; imag: number }[] = results?.constellation?.received;
    if (!ideal?.length || !received?.length) return 'N/A';

    const len = Math.min(ideal.length, received.length);
    let errorPower = 0;
    let refPower = 0;
    for (let i = 0; i < len; i++) {
      const dReal = received[i].real - ideal[i].real;
      const dImag = received[i].imag - ideal[i].imag;
      errorPower += dReal * dReal + dImag * dImag;
      refPower += ideal[i].real * ideal[i].real + ideal[i].imag * ideal[i].imag;
    }
    if (refPower === 0) return 'N/A';
    return (Math.sqrt(errorPower / refPower) * 100).toFixed(2) + '%';
  }

  hasResults(sim: SimulationEntry): boolean {
    return !!(sim.results as any)?.ber?.length;
  }

  getThroughputMbps(sim: SimulationEntry): string {
    const raw = (sim.results as any)?.avg_throughput;
    if (raw === undefined || raw === null) return 'N/A';
    return (raw / 1000000).toFixed(2);
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  showConfirmDelete = false;
  isDeleting = false;
  deleteError = '';

  isOwner(sim: SimulationEntry): boolean {
    return sim.owner_id === this.currentUser?.id;
  }

  requestDelete(sim: SimulationEntry, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedSim = sim;
    this.showDetail = true;
    this.showConfirmDelete = true;
    this.deleteError = '';
  }

  cancelDelete(): void {
    this.showConfirmDelete = false;
    this.deleteError = '';
  }

  confirmDelete(): void {
    if (!this.selectedSim) return;
    this.isDeleting = true;
    this.deleteError = '';

    this.simService.deleteConfig(this.selectedSim.id).subscribe({
      next: () => {
        this.simulations = this.simulations.filter(s => s.id !== this.selectedSim!.id);
        this.isDeleting = false;
        this.showConfirmDelete = false;
        this.closeDetail();
      },
      error: (err) => {
        this.deleteError = err.error?.message ?? 'Failed to delete. Try again.';
        this.isDeleting = false;
      }
    });
  }

}