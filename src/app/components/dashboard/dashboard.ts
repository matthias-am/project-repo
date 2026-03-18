import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatRippleModule } from '@angular/material/core';
import {MatMenuModule} from '@angular/material/menu';
import {MatDividerModule} from '@angular/material/divider';
import {Auth} from '../../services/auth';

export interface RecentSimulation {
  name: string;
  timeAgo: string;
  status: 'completed' | 'running' | 'failed';
  scheme: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatRippleModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {

  recentSimulations: RecentSimulation[] = [
    { name: '64-QAM BER Analysis',       timeAgo: '2 hours ago', status: 'completed', scheme: '64-QAM'  },
    { name: 'QPSK vs 16-QAM Comparison', timeAgo: '5 hours ago', status: 'completed', scheme: 'QPSK'    },
    { name: 'High SNR Performance',       timeAgo: 'Yesterday',   status: 'completed', scheme: 'BPSK'    },
    { name: '256-QAM Noise Study',        timeAgo: '2 days ago',  status: 'failed',    scheme: '256-QAM' },
  ];
  
  currentUser: any;
  

 

 constructor(private auth: Auth) {
  this.currentUser = this.auth.getUser();
 }

 logout(): void {
  this.auth.logout();
 }
  

}