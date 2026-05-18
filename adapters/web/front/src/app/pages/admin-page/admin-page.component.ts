import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../types/home.types';
import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdminPanelComponent } from '../../components/admin-panel/admin-panel.component';
import { CreateUserModalComponent } from '../../components/create-user-modal/create-user-modal.component';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, AdminPanelComponent, CreateUserModalComponent],
  templateUrl: './admin-page.component.html',
})
export class AdminPageComponent implements OnInit, OnDestroy {
  private apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;
  currentUser: User | null = null;
  allUsers: User[] = [];
  schedulerStatus: any = null;
  showCreateUserModal = false;
  createUserForm = { username: '', email: '', password: '', is_admin: false };
  private sub = new Subscription();
  private refreshInterval: any;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub.add(this.authService.currentUser$.subscribe(u => {
      this.currentUser = u;
      if (u?.is_admin) { this.loadAllUsers(); this.refreshSchedulerStatus(); }
      this.cdr.detectChanges();
    }));
    this.refreshInterval = setInterval(() => {
      if (this.currentUser?.is_admin) this.refreshSchedulerStatus();
    }, 30000);
  }

  async loadAllUsers() {
    try {
      const response: any = await this.http.get(`${this.apiUrl}/admin/users`).toPromise();
      this.allUsers = response.users;
      this.cdr.detectChanges();
    } catch {}
  }

  async refreshSchedulerStatus() {
    try {
      this.schedulerStatus = await this.http.get(`${this.apiUrl}/admin/scheduler/status`).toPromise();
      this.cdr.detectChanges();
    } catch {}
  }

  async restartScheduler() {
    if (!confirm('Redémarrer le scheduler MAL ?')) return;
    try {
      await this.http.post(`${this.apiUrl}/admin/scheduler/restart`, {}).toPromise();
      alert('Scheduler redémarré !');
      setTimeout(() => this.refreshSchedulerStatus(), 2000);
    } catch { alert('Erreur lors du redémarrage'); }
  }

  async deleteUser(userId: number) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      await this.http.delete(`${this.apiUrl}/admin/users/${userId}`).toPromise();
      this.loadAllUsers();
    } catch (error: any) { alert(error.error?.error || 'Erreur'); }
  }

  async createUser() {
    try {
      await this.http.post(`${this.apiUrl}/admin/users`, this.createUserForm).toPromise();
      this.showCreateUserModal = false;
      this.createUserForm = { username: '', email: '', password: '', is_admin: false };
      this.loadAllUsers();
    } catch (error: any) { alert(error.error?.error || 'Erreur'); }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }
}
