import { Component, OnDestroy } from '@angular/core';
import { of, Subject, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AnimeService, Season } from './services/anime.service';
import { ChangeDetectorRef } from '@angular/core';
import { SocketService } from './services/socket.service';

interface DownloadNode {
  id: string;
  name: string;
  fileName: string;
  m3u8Url: string;
  downloadState: 'queued' | 'downloading' | 'encoding' | 'ready' | 'error';
  progress: number;
  estimatedDuration: number;
  progressPercent: number;
  fileSize: number;
  downloadUrl: string;
  downloadSubscription: Subscription | null;
  errorMessage?: string;
}

interface Episode {
  url: string;
  name: string;
  selected: boolean;
}

interface OldDownload {
  downloadId: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  createdAt: Date;
}

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy {
    searchInput = '';
    animes: { name: string; url: string }[] = [];
    seasons: Season[] = [];
    selectedAnime: { name: string; url: string } | null = null;
    isLoadingAnimes = false;
    isLoadingSeasons = false;
    isLoadingEpisodes = false;

    episodes: Episode[] = [];
    selectedSeason: Season = {name: "", link: ""};

    oldDownloads: OldDownload[] = [];
    isLoadingOldDownloads = false;

    downloadQueue: DownloadNode[] = [];
    maxConcurrentDownloads = 3;
    private downloadIdCounter = 0;

    private searchSubject = new Subject<string>();
    private subscription = new Subscription();

    constructor(
        private animeService: AnimeService,
        private cdr: ChangeDetectorRef,
        private socketService: SocketService
    ) {
        this.initSearchSubscription();
        this.loadExistingDownloads();
    }

    loadExistingDownloads(): void {
        this.isLoadingOldDownloads = true;
        this.animeService.getExistingDownloads().subscribe({
            next: (response) => {
                this.oldDownloads = response.downloads;
                this.isLoadingOldDownloads = false;
                this.cdr.detectChanges();
                console.log('Anciens téléchargements chargés:', this.oldDownloads);
            },
            error: (error) => {
                console.error('Erreur lors du chargement des anciens téléchargements:', error);
                this.isLoadingOldDownloads = false;
                this.cdr.detectChanges();
            }
        });
    }

    downloadOldFile(download: OldDownload): void {
        const link = document.createElement('a');
        link.href = download.downloadUrl;
        link.download = download.fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    deleteOldDownload(download: OldDownload): void {
        if (!confirm(`Voulez-vous vraiment supprimer "${download.fileName}" ?`)) {
            return;
        }

        this.animeService.deleteDownload(download.downloadId).subscribe({
            next: () => {
                const index = this.oldDownloads.indexOf(download);
                if (index > -1) {
                    this.oldDownloads.splice(index, 1);
                }
                this.cdr.detectChanges();
                console.log('Fichier supprimé avec succès');
            },
            error: (error) => {
                console.error('Erreur lors de la suppression:', error);
                alert('Erreur lors de la suppression du fichier');
            }
        });
    }

    getSelectedEpisodes(): Episode[] {
        return this.episodes.filter(ep => ep.selected);
    }

    toggleEpisode(episode: Episode): void {
        episode.selected = !episode.selected;
    }

    toggleAllEpisodes(): void {
        const allSelected = this.episodes.every(ep => ep.selected);
        this.episodes.forEach(ep => ep.selected = !allSelected);
    }

    areAllEpisodesSelected(): boolean {
        return this.episodes.length > 0 && this.episodes.every(ep => ep.selected);
    }

    validateDownloads(): void {
        const selectedEpisodes = this.getSelectedEpisodes();
        
        if (selectedEpisodes.length === 0) {
            alert('Veuillez sélectionner au moins un épisode');
            return;
        }

        selectedEpisodes.forEach(episode => {
            this.addToDownloadQueue(episode.url, episode.name, episode.name);
        });

        this.episodes.forEach(ep => ep.selected = false);
    }

    addToDownloadQueue(m3u8Url: string, fileName: string, episodeName: string) {
        const downloadId = `download-${++this.downloadIdCounter}`;
        
        const downloadNode: DownloadNode = {
            id: downloadId,
            name: episodeName,
            fileName: fileName,
            m3u8Url: m3u8Url,
            downloadState: 'queued',
            progress: 0,
            estimatedDuration: 0,
            progressPercent: 0,
            fileSize: 0,
            downloadUrl: '',
            downloadSubscription: null
        };

        this.downloadQueue.push(downloadNode);
        this.cdr.detectChanges();
        this.processQueue();
    }

    private processQueue() {
        const activeDownloads = this.downloadQueue.filter(
            d => d.downloadState === 'downloading' || d.downloadState === 'encoding'
        );

        if (activeDownloads.length >= this.maxConcurrentDownloads) {
            return;
        }

        const queuedDownloads = this.downloadQueue.filter(d => d.downloadState === 'queued');
        const slotsAvailable = this.maxConcurrentDownloads - activeDownloads.length;

        queuedDownloads.slice(0, slotsAvailable).forEach(download => {
            this.startDownload(download);
        });
    }

    private startDownload(downloadNode: DownloadNode) {
    downloadNode.downloadState = 'downloading';
    downloadNode.downloadSubscription = new Subscription();

    this.cdr.detectChanges();

    this.socketService.downloadEpisode(downloadNode.m3u8Url, downloadNode.fileName, downloadNode.id);

    downloadNode.downloadSubscription.add(
        this.socketService.onProgress().subscribe(data => {
            if (data.downloadId === downloadNode.id) {
                downloadNode.progress = data.current;
                downloadNode.downloadState = 'encoding';
                
                if (downloadNode.progress > 30 && downloadNode.estimatedDuration === 0) {
                    downloadNode.estimatedDuration = downloadNode.progress * 1.1;
                }
                
                if (downloadNode.estimatedDuration > 0) {
                    downloadNode.progressPercent = Math.min(
                        Math.round((downloadNode.progress / downloadNode.estimatedDuration) * 100),
                        99
                    );
                }
                
                this.cdr.detectChanges();
            }
        })
    );

    downloadNode.downloadSubscription.add(
        this.socketService.onDownloadReady().subscribe(({ downloadUrl, fileName, fileSize, downloadId }) => {
            if (downloadId === downloadNode.id) {
                downloadNode.downloadState = 'ready';
                downloadNode.progressPercent = 100;
                downloadNode.fileSize = fileSize;
                downloadNode.downloadUrl = downloadUrl;
                
                this.cdr.detectChanges();
                this.processQueue();
            }
        })
    );

    downloadNode.downloadSubscription.add(
        this.socketService.onError().subscribe(err => {
            if (err.downloadId === downloadNode.id) {
                downloadNode.downloadState = 'error';
                downloadNode.errorMessage = err.message;
                this.cdr.detectChanges();
                this.processQueue();
            }
        })
    );
}

    triggerDownload(downloadNode: DownloadNode) {
        if (downloadNode.downloadState !== 'ready') return;

        const link = document.createElement('a');
        link.href = downloadNode.downloadUrl;
        link.download = downloadNode.fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    removeDownload(downloadNode: DownloadNode) {
        if (downloadNode.downloadSubscription) {
            downloadNode.downloadSubscription.unsubscribe();
        }

        const index = this.downloadQueue.indexOf(downloadNode);
        if (index > -1) {
            this.downloadQueue.splice(index, 1);
        }

        this.cdr.detectChanges();
        this.processQueue();
    }

    retryDownload(downloadNode: DownloadNode) {
        if (downloadNode.downloadState === 'error') {
            downloadNode.downloadState = 'queued';
            downloadNode.progress = 0;
            downloadNode.progressPercent = 0;
            downloadNode.estimatedDuration = 0;
            downloadNode.errorMessage = undefined;
            this.cdr.detectChanges();
            this.processQueue();
        }
    }

    getActiveDownloads(): DownloadNode[] {
        return this.downloadQueue.filter(
            d => d.downloadState === 'downloading' || d.downloadState === 'encoding'
        );
    }

    getQueuedDownloads(): DownloadNode[] {
        return this.downloadQueue.filter(d => d.downloadState === 'queued');
    }

    getCompletedDownloads(): DownloadNode[] {
        return this.downloadQueue.filter(d => d.downloadState === 'ready');
    }

    formatTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        if (h > 0) {
            return `${h}h ${m}m ${s}s`;
        } else if (m > 0) {
            return `${m}m ${s}s`;
        } else {
            return `${s}s`;
        }
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    private initSearchSubscription(): void {
        const searchSub = this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(value => {
                if (!value.trim()) {
                    this.animes = [];
                    this.seasons = [];
                    return of(null);
                }
                this.isLoadingAnimes = true;
                return this.animeService.searchAnimes(value);
            })
        ).subscribe({
            next: (response) => {
                this.isLoadingAnimes = false;
                if (response && response.animesTitle) {
                    this.animes = Object.entries(response.animesTitle).map(([name, url]) => ({
                        name,
                        url
                    }));
                } else {
                    this.animes = [];
                }
                this.cdr.detectChanges();
                this.seasons = [];
            },
            error: (error) => {
                this.isLoadingAnimes = false;
                this.cdr.detectChanges();
                this.animes = [];
            }
        });

        this.subscription.add(searchSub);
    }

    onSearchInput(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.searchInput = value;
        this.searchSubject.next(value);
    }

    selectAnime(anime: { name: string; url: string }): void {
        this.selectedAnime = anime;
        this.searchInput = anime.name;
        this.animes = [];
        this.isLoadingSeasons = true;
        this.episodes = [];

        this.animeService.getSeasons(anime.url).subscribe({
            next: (response) => {
                this.isLoadingSeasons = false;
                if (response && response.animeSeasons) {
                    this.seasons = response.animeSeasons.map(season => ({
                        ...season,
                        link: `${anime.url}${season.link}`
                    }));
                }
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Erreur lors du chargement des saisons:', error);
                this.isLoadingSeasons = false;
                this.cdr.detectChanges();
            }
        });
    }

    selectSeason(season: Season): void {
        if (!this.selectedAnime) return;
        this.selectedSeason = season;
        this.isLoadingEpisodes = true;

        this.animeService.getEpisodes(season.link).subscribe({
            next: (response) => {                
                if (response && response.m3u8url) {
                    this.episodes = response.m3u8url.flat().map((url, index) => ({
                        url: url,
                        name: `${this.selectedAnime!.name}-${season.name}-Episode-${index + 1}.mp4`,
                        selected: false
                    }));
                } else {
                    alert("Erreur: URL de l'épisode introuvable");
                }
                this.isLoadingEpisodes = false;
                this.cdr.detectChanges();
            },
            error: (error) => {
                this.isLoadingEpisodes = false;
                alert('Erreur lors de la récupération des épisodes');
                this.cdr.detectChanges();
            }
        });
    }

    clearSearch(): void {
        this.searchInput = '';
        this.animes = [];
        this.seasons = [];
        this.selectedAnime = null;
        this.episodes = [];
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        
        this.downloadQueue.forEach(download => {
            if (download.downloadSubscription) {
                download.downloadSubscription.unsubscribe();
            }
        });
    }
}