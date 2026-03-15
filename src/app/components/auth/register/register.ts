import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatToolbarModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {

  fields = { username: '', email: '', password: '', confirmPassword: '' };

  showPassword        = false;
  showConfirmPassword = false;
  isLoading           = false;
  registerError       = false;
  errorMessage        = '';

  constructor(private auth: Auth, private router: Router) {}

  togglePassword():        void { this.showPassword        = !this.showPassword; }
  toggleConfirmPassword(): void { this.showConfirmPassword = !this.showConfirmPassword; }

  get passwordMismatch(): boolean {
    return !!this.fields.confirmPassword && this.fields.password !== this.fields.confirmPassword;
  }

  onSubmit(): void {
    if (this.passwordMismatch) return;

    this.registerError = false;
    this.isLoading     = true;

    const { username, email, password } = this.fields;

    this.auth.register({ username, email, password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isLoading     = false;
        this.registerError = true;
        if (err.status === 400) {
          const msg = err.error?.message || err.error?.errors?.[0]?.msg;
          this.errorMessage = msg ?? 'Registration failed. Check your details.';
        } else {
          this.errorMessage = 'Server error. Please try again.';
        }
      }
    });
  }
}