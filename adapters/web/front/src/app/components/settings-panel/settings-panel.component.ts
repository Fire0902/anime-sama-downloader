import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AnimeService } from '../../services/anime.service';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'maxConcurrentDownloads';
const API_URL_KEY = 'apiUrl';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AccordionSectionComponent],
  templateUrl: './settings-panel.component.html',
})
export class SettingsPanelComponent implements OnInit {
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
  @Output() onMaxConcurrentChange = new EventEmitter<number>();

  maxConcurrent = 3;

  apiUrl = localStorage.getItem(API_URL_KEY) || environment.apiUrl;
  apiUrlSaved = false;

  jellyseerrUrl = '';
  jellyseerrToken = '';
  jellyseerrHasToken = false;
  jellyseerrLoading = false;
  jellyseerrSaving = false;
  jellyseerrError: string | null = null;
  jellyseerrSuccess = false;

  constructor(private animeService: AnimeService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.maxConcurrent = saved ? parseInt(saved, 10) : 3;
    this.loadJellyseerrConfig();
  }

  onChange(): void {
    localStorage.setItem(STORAGE_KEY, String(this.maxConcurrent));
    this.onMaxConcurrentChange.emit(this.maxConcurrent);
  }

  saveApiUrl(): void {
    const trimmed = this.apiUrl.trim().replace(/\/$/, '');
    localStorage.setItem(API_URL_KEY, trimmed);
    this.apiUrlSaved = true;
    setTimeout(() => {
      this.apiUrlSaved = false;
      window.location.reload();
    }, 800);
  }

  resetApiUrl(): void {
    localStorage.removeItem(API_URL_KEY);
    this.apiUrl = environment.apiUrl;
    window.location.reload();
  }

  loadJellyseerrConfig(): void {
    this.jellyseerrLoading = true;
    this.animeService.getJellyseerrConfig().subscribe({
      next: (data) => {
        this.jellyseerrUrl = data.url;
        this.jellyseerrHasToken = data.hasToken;
        this.jellyseerrLoading = false;
      },
      error: () => {
        this.jellyseerrLoading = false;
      },
    });
  }

  saveJellyseerrConfig(): void {
    this.jellyseerrError = null;
    this.jellyseerrSuccess = false;
    this.jellyseerrSaving = true;
    this.animeService.saveJellyseerrConfig(this.jellyseerrUrl, this.jellyseerrToken).subscribe({
      next: () => {
        this.jellyseerrSaving = false;
        this.jellyseerrSuccess = true;
        this.jellyseerrHasToken = this.jellyseerrHasToken || !!this.jellyseerrToken;
        this.jellyseerrToken = '';
        setTimeout(() => (this.jellyseerrSuccess = false), 3000);
      },
      error: (err) => {
        this.jellyseerrSaving = false;
        this.jellyseerrError = err?.error?.error ?? 'Erreur lors de la sauvegarde';
      },
    });
  }
}
