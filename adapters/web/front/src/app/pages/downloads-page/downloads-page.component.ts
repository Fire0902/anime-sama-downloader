import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DownloadStateService } from '../../services/download-state.service';
import { AnimeService } from '../../services/anime.service';
import { DownloadNode, Download, DownloadHierarchy } from '../../types/home.types';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { environment } from '../../../environments/environment';
import { VideoModalComponent } from '../../components/video-modal/video-modal.component';
import { ZipProgressModalComponent } from '../../components/zip-progress-modal/zip-progress-modal.component';

type FilterTab = 'all' | 'active' | 'completed' | 'errors';

@Component({
  selector: 'app-downloads-page',
  standalone: true,
  imports: [CommonModule, VideoModalComponent, ZipProgressModalComponent],
  templateUrl: './downloads-page.component.html',
})
export class DownloadsPageComponent implements OnInit, OnDestroy {
  private apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;
  activeTab: FilterTab = 'all';
  downloadQueue: DownloadNode[] = [];
  hierarchy: DownloadHierarchy[] = [];

  showVideoModal = false;
  currentVideoEpisode: Download | null = null;
  showZipProgressModal = false;

  private sub = new Subscription();

  constructor(
    private downloadState: DownloadStateService,
    private animeService: AnimeService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub.add(
      this.downloadState.downloadQueue$.subscribe(queue => {
        this.downloadQueue = queue;
        this.cdr.detectChanges();
      })
    );
    this.sub.add(
      this.downloadState.downloadReady$.subscribe(() => {
        this.loadHierarchy();
      })
    );
    this.loadHierarchy();
  }

  loadHierarchy() {
    this.http.get<{ hierarchy: DownloadHierarchy[] }>(`${this.apiUrl}/downloads/hierarchy`).subscribe({
      next: res => { this.hierarchy = res.hierarchy || []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  get activeDownloads(): DownloadNode[] {
    return this.downloadQueue.filter(d => d.downloadState === 'downloading' || d.downloadState === 'encoding' || d.downloadState === 'queued');
  }

  get erroredDownloads(): DownloadNode[] {
    return this.downloadState.getErroredDownloads();
  }

  get completedEpisodes(): { anime: string; season: string; ep: Download }[] {
    const result: { anime: string; season: string; ep: Download }[] = [];
    for (const a of this.hierarchy) {
      for (const s of a.seasons) {
        for (const ep of s.episodes) {
          result.push({ anime: a.anime_name, season: s.season_name, ep });
        }
      }
    }
    return result;
  }

  get tabs(): { id: FilterTab; label: string; count: number }[] {
    return [
      { id: 'all', label: 'Tous', count: this.activeDownloads.length + this.completedEpisodes.length + this.erroredDownloads.length },
      { id: 'active', label: 'En cours', count: this.activeDownloads.length },
      { id: 'completed', label: 'Terminés', count: this.completedEpisodes.length },
      { id: 'errors', label: 'Erreurs', count: this.erroredDownloads.length },
    ];
  }

  removeQueuedDownload(node: DownloadNode) { this.downloadState.removeDownload(node); }
  retryDownload(node: DownloadNode) { this.downloadState.retryDownload(node); }
  clearErrors() { this.downloadState.clearErroredDownloads(); }

  async deleteDownload(downloadId: string) {
    if (!confirm('Supprimer ce téléchargement ?')) return;
    try {
      await this.http.delete(`${this.apiUrl}/downloads/${downloadId}`).toPromise();
      this.loadHierarchy();
    } catch (error) { console.error('Delete error:', error); }
  }

  downloadEpisode(episode: Download) {
    window.open(`${this.apiUrl}/downloads/${episode.id}`, '_blank');
  }

  playVideo(episode: Download) {
    this.currentVideoEpisode = episode;
    this.showVideoModal = true;
  }

  async zipAnime(animeName: string) {
    this.showZipProgressModal = true;
    this.cdr.detectChanges();
    try {
      const blob = await this.http.post(`${this.apiUrl}/downloads/zip/anime`, { animeName }, { responseType: 'blob' }).toPromise();
      this.showZipProgressModal = false;
      this.cdr.detectChanges();
      this.triggerBlobDownload(blob as Blob, `${animeName}.zip`);
    } catch { this.showZipProgressModal = false; this.cdr.detectChanges(); alert('Erreur ZIP'); }
  }

  async zipSeason(animeName: string, seasonName: string) {
    this.showZipProgressModal = true;
    this.cdr.detectChanges();
    try {
      const blob = await this.http.post(`${this.apiUrl}/downloads/zip/season`, { animeName, seasonName }, { responseType: 'blob' }).toPromise();
      this.showZipProgressModal = false;
      this.cdr.detectChanges();
      this.triggerBlobDownload(blob as Blob, `${animeName}_${seasonName}.zip`);
    } catch { this.showZipProgressModal = false; this.cdr.detectChanges(); alert('Erreur ZIP'); }
  }

  private triggerBlobDownload(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    window.URL.revokeObjectURL(url);
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  stateLabel(state: string): string {
    const map: Record<string, string> = { queued: 'En file', downloading: 'Téléchargement', encoding: 'Encodage', ready: 'Prêt', error: 'Erreur' };
    return map[state] || state;
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}
