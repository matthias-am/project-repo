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

//parameters
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
export class LibraryComponent implements OnInit {  //uses ngOnit

  searchQuery = ''; //stores what user types in search bob
  activeFilter = 'All'; //keeps track of the currently select filter, default is all
  isLoading = true; //loading spinner is shown, default is true
  errorMsg = ''; //holds any error msg to display to user
  filters = ['All', 'BPSK', 'QPSK', '16QAM', '64QAM', '256QAM']; //filter options
  simulations: SimulationEntry[] = []; //stores all the user's ssaved sims/configs after loaded from the backend
  currentUser: ReturnType<Auth['getUser']> = null; //stores logged in user info

  // Detail panel
  selectedSim: SimulationEntry | null = null; //holds the sim the user clicked on to view in detail
  showDetail = false; //whether detail panel is visible or not

  constructor(
    //private http: HttpClient,
    private simService: SimulationService, //used to call backend APIs
    private auth: Auth, //used to get current user and handle logout
    private router: Router //used to navigate to other pages
  ) { }

  ngOnInit(): void { //runs auto once component initialized
    this.currentUser = this.auth.getUser(); //gets from auth service 
    this.loadConfigs(); //fetches user's saved sims from server
  }

  loadConfigs(): void {
    this.isLoading = true; //resets to show sponner
    this.errorMsg = ''; //clears error msgs
    //this.http.get<any[]>('http://localhost:5001/api/configs/user').subscribe({
    this.simService.getMyConfigs().subscribe({ //gets Configs from background
      next: (configs) => {
        this.simulations = configs.map(c => ({ //converts raw backend data into simEntry format for UI
          id: c.config_id ?? c._id,
          name: c.name,
          scheme: this.normalizeScheme(c.scheme_id), //qpsk to QPSK
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
        this.isLoading = false; //hides loading spinner once data loaded
      },
      error: () => {
        this.errorMsg = 'Failed to load simulations.';
        this.isLoading = false;
      }
    });
  }

  openDetail(sim: SimulationEntry): void { //called when user clicks sim card
    //opens detail panel
    this.selectedSim = sim;
    this.showDetail = true;
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedSim = null;
  } //closes detail panel

  //navigates user to sim page and passes selected config
  loadIntoSimulator(): void {
    if (!this.selectedSim) return;
    this.router.navigate(['/simulation'], {
      state: { loadedConfig: this.selectedSim } //uses router state to pass config
    });
  }

  private normalizeScheme(schemeId: string): string {
    const map: Record<string, string> = {
      'bpsk': 'BPSK', 'qpsk': 'QPSK',
      '16qam': '16QAM', '64qam': '64QAM',
      '256qam': '256QAM', '1024qam': '1024QAM'
    };
    return map[schemeId?.toLowerCase()] ?? schemeId?.toUpperCase() ?? 'QPSK'; //converts raw scheme IDS from backend to display names
  }

  //returns filtered version of the sims array
  get filtered(): SimulationEntry[] {
    return this.simulations.filter(s => {
      const matchesFilter = this.activeFilter === 'All' || s.scheme === this.activeFilter; //filter by scheme
      const matchesSearch = s.name.toLowerCase().includes(this.searchQuery.toLowerCase()); //filter by search match
      return matchesFilter && matchesSearch;
    });
  }

  //stared propert on card
  toggleStar(sim: SimulationEntry, event: Event): void {
    event.preventDefault();
    event.stopPropagation(); //stops the star click from opening detail panel
    sim.starred = !sim.starred;
  }

  setFilter(filter: string): void { this.activeFilter = filter; } //changes the active filter when a filter button is clicked

  logout(): void { this.auth.logout(); } //calls logout method

  schemeColor(scheme: string): string {
    const map: Record<string, string> = {
      'BPSK': '#22d3ee', 'QPSK': '#818cf8',
      '16QAM': '#34d399', '64QAM': '#f59e0b',
      '256QAM': '#f87171', '1024QAM': '#c084fc'
    };
    return map[scheme] ?? '#7d8590'; //returns a specific color code for each modulation scheme
  }
  // ── Results helpers 

  //returns BER at sim's SNR value in scientific notation
  getBerAtSnr(sim: SimulationEntry): string {
    const results = sim.results as any; //takes results object and casts as any
    if (!results?.ber || !results?.snr_db) return 'N/A'; //if missing return n/a
    const snrArr: number[] = results.snr_db; //snr values at which BER was calced
    const berArr: number[] = results.ber; //array of corresponding BER values
    // Find the index closest to the saved SNR point
    const idx = snrArr.reduce((best, val, i) =>
      Math.abs(val - sim.snr) < Math.abs(snrArr[best] - sim.snr) ? i : best, 0); //loops through all Snr values and finds the closest
    return berArr[idx] !== undefined ? berArr[idx].toExponential(3) : 'N/A'; //converts valid BER valie to scientific notation
  }

  //calcs EVM in percentage by comparing ideal and received constellation points
  getEvm(sim: SimulationEntry): string { //takes simEntry and returns a string
    const results = sim.results as any; //extracts results object and casts to any
    const ideal: { real: number; imag: number }[] = results?.constellation?.ideal; //extras array of ideal contellation points from results
    const received: { real: number; imag: number }[] = results?.constellation?.received; //same for recieved
    if (!ideal?.length || !received?.length) return 'N/A'; //if either is empty, return


    const len = Math.min(ideal.length, received.length); //calcs how many const points we can safely compare
    let errorPower = 0; //total squared error between recieved and ideal
    let refPower = 0; //total power of ideal
    for (let i = 0; i < len; i++) {
      const dReal = received[i].real - ideal[i].real; //calcs the diff in the real and image 
      const dImag = received[i].imag - ideal[i].imag;
      errorPower += dReal * dReal + dImag * dImag; //adds squared length of error vector (squared eucilidean distance
      refPower += ideal[i].real * ideal[i].real + ideal[i].imag * ideal[i].imag; //adds squared  magn of ideal point
    }
    if (refPower === 0) return 'N/A';
    return (Math.sqrt(errorPower / refPower) * 100).toFixed(2) + '%'; //EVM formula
  }

  //returns true is sim has actual results, to decide if to show resul metrics
  hasResults(sim: SimulationEntry): boolean {
    return !!(sim.results as any)?.ber?.length;
  }

  //convert avg tthroughput from bps to MBPS
  getThroughputMbps(sim: SimulationEntry): string {
    const raw = (sim.results as any)?.avg_throughput;
    if (raw === undefined || raw === null) return 'N/A';
    return (raw / 1000000).toFixed(2);
  }

  // ── Delete 

  //state variables
  showConfirmDelete = false;
  isDeleting = false;
  deleteError = '';

  //checks if user owns the sum
  isOwner(sim: SimulationEntry): boolean {
    return sim.owner_id === this.currentUser?.id;
  }

  //prepares delete 
  requestDelete(sim: SimulationEntry, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedSim = sim; //selects sim
    this.showDetail = true; //opens detail panel
    this.showConfirmDelete = true; //shows confirm dialogue
    this.deleteError = '';
  }

  //cancels delete and hides confirm box
  cancelDelete(): void {
    this.showConfirmDelete = false;
    this.deleteError = '';
  }

  //calls the backend service to actually delete
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