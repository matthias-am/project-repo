import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth';

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
    CommonModule, RouterModule, FormsModule,
    MatIconModule, MatButtonModule, MatToolbarModule,
    MatRippleModule, MatMenuModule, MatProgressSpinnerModule,
    MatDividerModule
  ],
  templateUrl: './library.html',
  styleUrl: './library.css'
})
export class LibraryComponent implements OnInit {

  searchQuery  = '';
  activeFilter = 'All';
  isLoading    = true;
  errorMsg     = '';
  filters = ['All', 'BPSK', 'QPSK', '16QAM', '64QAM', '256QAM'];
  simulations: SimulationEntry[] = [];
  currentUser: ReturnType<Auth['getUser']> = null;

  constructor(private http: HttpClient, private auth: Auth) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser();
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    this.http.get<any[]>('http://localhost:5001/api/configs/user').subscribe({
      next: (configs) => {
        this.simulations = configs.map(c => ({
          id:      c.config_id ?? c._id,
          name:    c.name,
          scheme:  this.normalizeScheme(c.scheme_id),
          date:    new Date(c.created_at).toLocaleDateString('en-CA'),
          status:  'completed' as const,
          starred: false,
          snr:     c.parameters?.const_ebn0_db ?? 0,
          method:  c.parameters?.method ?? 'Monte Carlo'
        }));
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg  = 'Failed to load simulations.';
        this.isLoading = false;
      }
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
}