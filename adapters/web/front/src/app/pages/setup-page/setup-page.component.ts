import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-setup-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-page.component.html',
})
export class SetupPageComponent {
  private apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;

  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  isLoading = false;
  done = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
  ) {}

  onSubmit() {
    this.errorMessage = '';

    if (!this.username || this.username.trim().length < 3) {
      this.errorMessage = 'Le nom d\'utilisateur doit contenir au moins 3 caractères';
      return;
    }
    if (!this.email || !this.email.includes('@')) {
      this.errorMessage = 'Adresse email invalide';
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas';
      return;
    }

    this.isLoading = true;

    // Register the first admin (backend allows register when no users exist)
    this.http.post<{ user: any }>(`${this.apiUrl}/auth/register`, {
      username: this.username,
      email: this.email,
      password: this.password,
      is_admin: true,
    }).subscribe({
      next: () => {
        // Auto-login
        this.authService.login(this.username, this.password).subscribe({
          next: () => this.router.navigate(['/']),
          error: () => {
            this.isLoading = false;
            this.router.navigate(['/login']);
          }
        });
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Erreur lors de la création du compte';
        this.isLoading = false;
      }
    });
  }
}
