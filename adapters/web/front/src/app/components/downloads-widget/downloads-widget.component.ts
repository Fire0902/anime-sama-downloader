import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DownloadStateService } from '../../services/download-state.service';
import { DownloadNode } from '../../types/home.types';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-downloads-widget',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './downloads-widget.component.html',
})
export class DownloadsWidgetComponent implements OnInit, OnDestroy {
  apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;
  isExpanded = false;
  isOnDownloadsPage = false;
  activeDownloads: DownloadNode[] = [];
  private sub = new Subscription();

  constructor(
    private downloadState: DownloadStateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.isOnDownloadsPage = this.router.url === '/downloads';
    this.sub.add(
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
        this.isOnDownloadsPage = e.urlAfterRedirects === '/downloads';
        if (this.isOnDownloadsPage) this.isExpanded = false;
      })
    );
    this.sub.add(
      this.downloadState.downloadQueue$.subscribe(queue => {
        this.activeDownloads = queue.filter(
          d => d.downloadState === 'downloading' || d.downloadState === 'encoding' || d.downloadState === 'queued'
        );
        this.cdr.detectChanges();
      })
    );
  }

  get activeCount(): number {
    return this.activeDownloads.length;
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
