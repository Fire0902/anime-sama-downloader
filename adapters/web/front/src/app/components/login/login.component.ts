import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  isLoginMode = true;
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
    this.password = '';
    this.confirmPassword = '';
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.username || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    if (!this.isLoginMode) {
      if (!this.email) {
        this.errorMessage = 'Veuillez remplir tous les champs';
        return;
      }

      if (this.password !== this.confirmPassword) {
        this.errorMessage = 'Les mots de passe ne correspondent pas';
        return;
      }

      if (this.password.length < 6) {
        this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
        return;
      }
    }

    this.isLoading = true;

    if (this.isLoginMode) {
      this.authService.login(this.username, this.password).subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: (error) => {
          console.error('Login error:', error);
          this.errorMessage = error.error?.error || 'Erreur de connexion';
          this.isLoading = false;
        }
      });
    } else {
      this.authService.register(this.username, this.email, this.password).subscribe({
        next: () => {
          // Auto-login après inscription
          this.authService.login(this.username, this.password).subscribe({
            next: () => {
              this.router.navigate(['/']);
            },
            error: (error) => {
              console.error('Auto-login error:', error);
              this.isLoginMode = true;
              this.errorMessage = 'Inscription réussie, veuillez vous connecter';
              this.isLoading = false;
            }
          });
        },
        error: (error) => {
          console.error('Registration error:', error);
          this.errorMessage = error.error?.error || 'Erreur lors de l\'inscription';
          this.isLoading = false;
        }
      });
    }
  }
}