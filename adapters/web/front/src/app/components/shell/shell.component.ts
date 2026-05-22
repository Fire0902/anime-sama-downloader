import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
import { DownloadStateService } from '../../services/download-state.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { DownloadsWidgetComponent } from '../downloads-widget/downloads-widget.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SidebarComponent,
    DownloadsWidgetComponent,
  ],
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  mobileMenuOpen = false;
  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private downloadStateService: DownloadStateService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.sub.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.downloadStateService.loadInProgressDownloads();
          this.downloadStateService.loadErroredDownloads();
        }
        this.cdr.detectChanges();
      })
    );
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(this.sidebarCollapsed));
  }

  openMobileMenu() { this.mobileMenuOpen = true; }
  closeMobileMenu() { this.mobileMenuOpen = false; }

  logout() {
    this.authService.logout().subscribe(() => {});
  }

  get isAdmin(): boolean {
    return this.currentUser?.is_admin ?? false;
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
