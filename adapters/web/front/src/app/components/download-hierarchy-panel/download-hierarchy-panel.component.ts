import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DownloadHierarchy, Download } from '../../types/home.types';

@Component({
  selector: 'app-download-hierarchy-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download-hierarchy-panel.component.html',
})
export class DownloadHierarchyPanelComponent {
  @Input() hierarchy: DownloadHierarchy[] = [];
  @Input() expanded = false;
  @Input() expandedAnimes: { [key: string]: boolean } = {};
  @Input() expandedSeasons: { [key: string]: boolean } = {};

  @Output() onToggle = new EventEmitter<void>();
  @Output() onToggleAnime = new EventEmitter<string>();
  @Output() onToggleSeason = new EventEmitter<{ anime: string; season: string }>();
  @Output() onZipAnime = new EventEmitter<string>();
  @Output() onZipSeason = new EventEmitter<{ anime: string; season: string }>();
  @Output() onPlay = new EventEmitter<Download>();
  @Output() onDownload = new EventEmitter<Download>();
  @Output() onDelete = new EventEmitter<string>();

  getTotalDownloadsCount(): number {
    return this.hierarchy.length;
  }

  getTotalEpisodesForAnime(anime: DownloadHierarchy): number {
    return anime.seasons.reduce((total, season) => total + season.episodes.length, 0);
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
