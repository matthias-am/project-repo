import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatRippleModule } from '@angular/material/core';

export interface SimulationEntry {
  id: string;
  name: string;
  scheme: string;
  date: string;
  status: 'completed' | 'failed' | 'running';
  starred: boolean;
  snr: number;
  method: string;
}

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatRippleModule,
  ],
  templateUrl: './library.html',
  styleUrl: './library.css'
})
export class LibraryComponent {

  searchQuery = '';
  activeFilter = 'All';

  filters = ['All', 'BPSK', 'QPSK', '16QAM', '64QAM', '256QAM'];

  simulations: SimulationEntry[] = [
    { id: '1', name: '64-QAM High SNR Analysis',     scheme: '64QAM',  date: '2024-11-12', status: 'completed', starred: true,  snr: 20, method: 'Monte Carlo' },
    { id: '2', name: 'QPSK vs 16-QAM Comparison',    scheme: 'QPSK',   date: '2024-11-11', status: 'completed', starred: false, snr: 10, method: 'Monte Carlo' },
    { id: '3', name: 'Low SNR Performance Study',     scheme: '16QAM',  date: '2024-11-10', status: 'completed', starred: true,  snr: 2,  method: 'Theoretical' },
    { id: '4', name: 'BPSK Baseline Test',            scheme: 'BPSK',   date: '2024-11-09', status: 'completed', starred: false, snr: 15, method: 'Monte Carlo' },
    { id: '5', name: '256-QAM Advanced Analysis',     scheme: '256QAM', date: '2024-11-08', status: 'completed', starred: false, snr: 30, method: 'Theoretical' },
    { id: '6', name: 'QPSK Interference Study',       scheme: 'QPSK',   date: '2024-11-07', status: 'failed',   starred: false, snr: 8,  method: 'Monte Carlo' },
  ];

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

  setFilter(filter: string): void {
    this.activeFilter = filter;
  }

  schemeColor(scheme: string): string {
    const map: Record<string, string> = {
      'BPSK':   '#22d3ee',
      'QPSK':   '#818cf8',
      '16QAM':  '#34d399',
      '64QAM':  '#f59e0b',
      '256QAM': '#f87171',
    };
    return map[scheme] ?? '#7d8590';
  }
}