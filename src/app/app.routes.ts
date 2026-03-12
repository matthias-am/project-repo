import { Routes } from '@angular/router';
import {LoginComponent} from './components/auth/login/login';
import { SimulationComponent} from './components/simulation/simulation';
import { DashboardComponent } from './components/dashboard/dashboard';
import { LibraryComponent } from './components/library/Library';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full'},
    {path: 'login', component: LoginComponent},
    {path: 'dashboard', component: SimulationComponent},
    {path: 'simulation', component: SimulationComponent},
    { path: 'dashboard', component: DashboardComponent },
    {path: 'library', component: LibraryComponent},
    
];
