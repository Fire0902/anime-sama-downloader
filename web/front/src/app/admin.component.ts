import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from './services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  users: User[] = [];
  isLoading = false;
  showCreateForm = false;
  
  newUser = {
    username: '',
    email: '',
    password: '',
    isAdmin: false
  };
  
  errorMessage = '';
  successMessage = '';

  private apiUrl = 'http://localhost:3000';

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.http.get<{ users: User[] }>(`${this.apiUrl}/admin/users`).subscribe({
      next: (response) => {
        this.users = response.users;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.errorMessage = 'Erreur lors du chargement des utilisateurs';
        this.isLoading = false;
      }
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.resetForm();
  }

  createUser(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    if (this.newUser.password.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      return;
    }

    this.isLoading = true;

    this.http.post<{ user: User }>(`${this.apiUrl}/admin/users`, this.newUser).subscribe({
      next: (response) => {
        this.successMessage = `Utilisateur ${response.user.username} créé avec succès`;
        this.loadUsers();
        this.resetForm();
        this.showCreateForm = false;
        this.isLoading = false;

        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error creating user:', error);
        this.errorMessage = error.error?.error || 'Erreur lors de la création de l\'utilisateur';
        this.isLoading = false;
      }
    });
  }

  deleteUser(user: User): void {
    if (user.id === this.authService.getCurrentUser()?.id) {
      this.errorMessage = 'Vous ne pouvez pas supprimer votre propre compte';
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.username}" ?`)) {
      return;
    }

    this.http.delete(`${this.apiUrl}/admin/users/${user.id}`).subscribe({
      next: () => {
        this.successMessage = `Utilisateur ${user.username} supprimé avec succès`;
        this.loadUsers();

        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        this.errorMessage = error.error?.error || 'Erreur lors de la suppression de l\'utilisateur';
      }
    });
  }

  resetForm(): void {
    this.newUser = {
      username: '',
      email: '',
      password: '',
      isAdmin: false
    };
    this.errorMessage = '';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}