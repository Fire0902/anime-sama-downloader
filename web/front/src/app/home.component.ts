import { Component, OnDestroy } from '@angular/core';
import { of, Subject, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AnimeService, Season } from './services/anime.service';
import { ChangeDetectorRef } from '@angular/core';
import { SocketService } from './services/socket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

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
    readerUrl: string;
    name: string;
    selected: boolean;
    episodeIndex: number;
}

interface OldDownload {
    downloadId: string;
    fileName: string;
    fileSize: number;
    downloadUrl: string;
    createdAt: Date;
}

interface User {
    id: number;
    username: string;
    email: string;
    is_admin: boolean;
}

interface Favorite {
    id: number;
    user_id: number;
    anime_name: string;
    anime_url: string;
    mal_id?: number;
    is_ongoing: boolean;
    last_episode_downloaded: number;
    next_episode_time: string;
    next_episode_at?: string;
}

interface Download {
    id: string;
    anime_name: string;
    season_name?: string;
    episode_name: string;
    file_path: string;
    file_size: number;
    status: string;
    progress: number;
    user_id: number;
}

interface DownloadHierarchy {
    anime_name: string;
    totalEpisodes: number;
    seasons: {
        season_name: string;
        episodes: Download[];
    }[];
}

interface MALResult {
    id: number;
    title: string;
}

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnDestroy {
    private apiUrl = 'http://localhost:3000';

    searchInput = '';
    animes: { name: string; url: string }[] = [];
    seasons: Season[] = [];
    selectedAnime: { name: string; url: string } | null = null;
    isLoadingAnimes = false;
    isLoadingSeasons = false;
    isLoadingEpisodes = false;
    episodes: Episode[] = [];
    selectedSeason: Season = { name: "", link: "" };
    oldDownloads: OldDownload[] = [];
    isLoadingOldDownloads = false;
    downloadQueue: DownloadNode[] = [];
    maxConcurrentDownloads = 3;
    private downloadIdCounter = 0;
    private searchSubject = new Subject<string>();
    private subscription = new Subscription();

    schedulerStatus: any = null;
    scheduledDownloads: any[] = [];

    showCreateUserModal = false;
    createUserForm = { username: '', email: '', password: '', is_admin: false };

    allUsers: User[] = [];

    currentUser: User | null = null;

    favorites: Favorite[] = [];
    showAddFavoriteModal = false;
    addFavoriteForm = { animeName: '', animeUrl: '', malId: null as number | null };
    malSearchQuery = '';
    malResults: MALResult[] = [];

    downloadHierarchy: DownloadHierarchy[] = [];

    expandedSections: { [key: string]: boolean } = {
        admin: false,
        favorites: false,
        active: true,
        downloads: false,
        queue: false
    };
    expandedAnimes: { [key: string]: boolean } = {};
    expandedSeasons: { [key: string]: boolean } = {};

    showVideoModal = false;
    currentVideoEpisode: Download | null = null;

    constructor(
        private animeService: AnimeService,
        private cdr: ChangeDetectorRef,
        private socketService: SocketService,
        private http: HttpClient,
        private router: Router
    ) {
        this.initSearchSubscription();
        if (localStorage.getItem('token')) {
            this.loadCurrentUser();
        }
    }


    // ==================== LOGIN ====================

    async loadCurrentUser() {
        try {
            const response: any = await this.http.get(`${this.apiUrl}/auth/me`).toPromise();
            console.log(response.user)
            this.currentUser = response.user;
            this.loadFavorites();
            this.loadDownloadHierarchy();
            if (this.currentUser?.is_admin) {
                this.loadAllUsers();
            }
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error loading user:', error);
            this.currentUser = null;
        }
    }

    async logout() {
        try {
            await this.http.post(`${this.apiUrl}/auth/logout`, {}).toPromise();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.currentUser = null;
            localStorage.removeItem('token');
            this.favorites = [];
            this.downloadHierarchy = [];
            this.allUsers = [];
            this.cdr.detectChanges();

            this.router.navigate(['/login']);
        }
    }

    // ==================== ADMIN ====================

    async loadAllUsers() {
        try {
            const response: any = await this.http.get(`${this.apiUrl}/admin/users`).toPromise();
            this.allUsers = response.users;
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async createUser() {
        try {
            await this.http.post(`${this.apiUrl}/admin/users`, this.createUserForm).toPromise();
            this.showCreateUserModal = false;
            this.createUserForm = { username: '', email: '', password: '', is_admin: false };
            this.loadAllUsers();
        } catch (error: any) {
            console.error('Create user error:', error);
            alert(error.error?.error || 'Erreur lors de la création');
        }
    }

    async deleteUser(userId: number) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
            return;
        }
        try {
            await this.http.delete(`${this.apiUrl}/admin/users/${userId}`).toPromise();
            this.loadAllUsers();
        } catch (error: any) {
            console.error('Delete user error:', error);
            alert(error.error?.error || 'Erreur lors de la suppression');
        }
    }

    // ==================== Favorite ====================

    async loadFavorites() {
        try {
            const response: any = await this.http.get(`${this.apiUrl}/favorites`).toPromise();
            this.favorites = response.favorites;
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }

    async addFavorite() {
        try {
            await this.http.post(`${this.apiUrl}/favorites`, this.addFavoriteForm).toPromise();
            this.showAddFavoriteModal = false;
            this.addFavoriteForm = { animeName: '', animeUrl: '', malId: null };
            this.malResults = [];
            this.loadFavorites();
        } catch (error: any) {
            console.error('Add favorite error:', error);
            alert(error.error?.error || 'Erreur lors de l\'ajout');
        }
    }

    async removeFavorite(favoriteId: number) {
        if (!confirm('Retirer cet anime de vos favoris ?')) {
            return;
        }
        try {
            await this.http.delete(`${this.apiUrl}/favorites/${favoriteId}`).toPromise();
            this.loadFavorites();
        } catch (error) {
            console.error('Remove favorite error:', error);
        }
    }

    async searchMAL() {
        if (!this.malSearchQuery.trim()) return;
        try {
            const response: any = await this.http.get(
                `${this.apiUrl}/mal/search?q=${encodeURIComponent(this.malSearchQuery)}`).toPromise();
            this.malResults = response.results;
            this.cdr.detectChanges();
        } catch (error) {
            console.error('MAL search error:', error);
        }
    }

    selectMALResult(result: MALResult) {
        this.addFavoriteForm.malId = result.id;
        this.malResults = [];
        this.malSearchQuery = result.title;
        this.cdr.detectChanges();
    }

    searchAnimeFromFavorite(favorite: Favorite) {
        this.searchInput = favorite.anime_name;
        this.searchSubject.next(favorite.anime_name);
    }

    addToFavorites(anime: any) {
        if (!this.currentUser) {
            alert('Veuillez vous connecter pour ajouter des favoris');
            return;
        }
        this.addFavoriteForm.animeName = anime.name;
        this.addFavoriteForm.animeUrl = anime.url;
        this.showAddFavoriteModal = true;
    }

    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR');
    }

    // ==================== Downloads ====================

    async loadDownloadHierarchy() {
        if (!this.currentUser) return;
        try {
            const response: any = await this.http.get(`${this.apiUrl}/downloads/hierarchy`).toPromise();
            this.downloadHierarchy = response.hierarchy;
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error loading hierarchy:', error);
        }
    }

    async zipAnime(animeName: string) {
        try {
            const blob = await this.http.post(
                `${this.apiUrl}/downloads/zip/anime`,
                { animeName },
                {
                    responseType: 'blob'
                }
            ).toPromise();

            const url = window.URL.createObjectURL(blob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${animeName}.zip`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Zip anime error:', error);
            alert('Erreur lors de la création du ZIP');
        }
    }

    async zipSeason(animeName: string, seasonName: string) {
        try {
            const blob = await this.http.post(
                `${this.apiUrl}/downloads/zip/season`,
                { animeName, seasonName },
                {
                    responseType: 'blob'
                }
            ).toPromise();

            const url = window.URL.createObjectURL(blob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${animeName}_${seasonName}.zip`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Zip season error:', error);
            alert('Erreur lors de la création du ZIP');
        }
    }

    async deleteDownload(downloadId: string) {
        if (!confirm('Supprimer ce téléchargement ?')) {
            return;
        }
        try {
            await this.http.delete(`${this.apiUrl}/downloads/${downloadId}`).toPromise();
            this.loadDownloadHierarchy();
        } catch (error) {
            console.error('Delete download error:', error);
        }
    }

    downloadEpisode(episode: Download) {
        window.open(`${this.apiUrl}/download/${episode.id}`, '_blank');
    }

    playVideo(episode: Download) {
        this.currentVideoEpisode = episode;
        this.showVideoModal = true;
    }

    closeVideoModal() {
        this.showVideoModal = false;
        this.currentVideoEpisode = null;
    }

    getTotalDownloadsCount(): number {
        return this.downloadHierarchy.reduce((total, _) => total + 1, 0);
    }

    getTotalEpisodesAnime(): number {
        return this.downloadHierarchy.reduce((total, anime) => total + anime.seasons.reduce((result, season) => result + season.episodes.reduce((result, _) => result + 1, 0), 0), 0);
    }

    // ==================== Accordion ====================

    toggleSection(section: string) {
        this.expandedSections[section] = !this.expandedSections[section];
        this.cdr.detectChanges();
    }

    toggleAnime(animeName: string) {
        this.expandedAnimes[animeName] = !this.expandedAnimes[animeName];
        this.cdr.detectChanges();
    }

    toggleSeason(animeName: string, seasonName: string) {
        const key = animeName + '/' + seasonName;
        this.expandedSeasons[key] = !this.expandedSeasons[key];
        this.cdr.detectChanges();
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
        if (!this.currentUser) {
            alert('Veuillez vous connecter pour télécharger');
            return;
        }

        const selectedEpisodes = this.getSelectedEpisodes();

        if (selectedEpisodes.length === 0) {
            alert('Veuillez sélectionner au moins un épisode');
            return;
        }

        selectedEpisodes.forEach(episode => {
            this.addToDownloadQueue(episode.readerUrl, episode.name, episode.name);
        });

        this.episodes.forEach(ep => ep.selected = false);
    }

    addToDownloadQueue(readerUrl: string, fileName: string, episodeName: string) {
        const downloadId = `download-${++this.downloadIdCounter}`;

        const downloadNode: DownloadNode = {
            id: downloadId,
            name: episodeName,
            fileName: fileName,
            m3u8Url: readerUrl,
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

        const userId = this.currentUser?.id;
        const animeName = this.selectedAnime?.name || 'unknown';
        const seasonName = this.selectedSeason?.name || 'unknown';

        this.socketService.downloadEpisode(
            downloadNode.m3u8Url,
            downloadNode.fileName,
            downloadNode.id,
            userId,
            animeName,
            seasonName
        );

        downloadNode.downloadSubscription.add(
            this.socketService.onDownloadIdAssigned().subscribe(({ clientDownloadId, serverDownloadId }) => {
                if (clientDownloadId === downloadNode.id) {
                    console.log(`Mapping: Client ID ${clientDownloadId} -> Server ID ${serverDownloadId}`);
                    downloadNode.id = serverDownloadId;
                }
            })
        );

        downloadNode.downloadSubscription.add(
            this.socketService.onDurationDetected().subscribe(({ downloadId, totalDuration }) => {
                if (downloadId === downloadNode.id) {
                    console.log(`[${downloadId}] Durée totale reçue: ${totalDuration}s`);
                    downloadNode.estimatedDuration = totalDuration;
                    this.cdr.detectChanges();
                }
            })
        );

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

                    this.loadDownloadHierarchy();

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

    async refreshSchedulerStatus() {
  try {
    const response = await this.http.get<any>(this.apiUrl + '/admin/scheduler/status', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).toPromise();
    
    this.schedulerStatus = response;
    console.log('Scheduler status:', this.schedulerStatus);
  } catch (error) {
    console.error('Error fetching scheduler status:', error);
  }
}

async restartScheduler() {
  if (!confirm('Êtes-vous sûr de vouloir redémarrer le scheduler MAL ?')) {
    return;
  }
  
  try {
    const response = await this.http.post<any>(this.apiUrl + '/admin/scheduler/restart', {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).toPromise();
    
    console.log('Scheduler restarted:', response);
    alert('Le scheduler a été redémarré avec succès !');
    
    setTimeout(() => {
      this.refreshSchedulerStatus();
    }, 2000);
  } catch (error) {
    console.error('Error restarting scheduler:', error);
    alert('Erreur lors du redémarrage du scheduler');
  }
}

async checkFavoriteNow(favoriteId: number) {
  try {
    const response = await this.http.post<any>(`http://localhost:3000/favorites/${favoriteId}/check-now`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).toPromise();
    
    console.log('Favorite check result:', response);
    
    const fav = response.favorite;
    let message = `${fav.anime_name}\n\n`;
    message += `Statut MAL: ${fav.mal_status}\n`;
    message += `Épisodes sur MAL: ${fav.num_episodes}\n`;
    message += `Derniers téléchargés: ${fav.last_downloaded}\n`;
    
    if (fav.new_episodes_available > 0) {
      message += `\n${fav.new_episodes_available} nouveau(x) épisode(s) disponible(s) !`;
    } else {
      message += `\nAucun nouvel épisode`;
    }
    
    if (fav.next_episode_broadcast) {
      message += `\n\nProchaine diffusion: ${fav.next_episode_broadcast.day} à ${fav.next_episode_broadcast.time} JST`;
    }
    
    alert(message);
    
    this.loadFavorites();
  } catch (error: any) {
    console.error('Error checking favorite:', error);
    alert('Erreur lors de la vérification: ' + (error.error?.error || error.message));
  }
}

async loadScheduledDownloads() {
  try {
    const response = await this.http.get<any>(this.apiUrl + '/favorites/scheduled', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).toPromise();
    
    this.scheduledDownloads = response.scheduled || [];
    console.log('Scheduled downloads:', this.scheduledDownloads);
  } catch (error) {
    console.error('Error loading scheduled downloads:', error);
    this.scheduledDownloads = [];
  }
}

formatTimeRemaining(milliseconds: number): string {
  if (!milliseconds || milliseconds < 0) return 'bientôt';
  
  const minutes = Math.floor(milliseconds / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}j ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}min`;
  } else {
    return `${minutes}min`;
  }
}

async ngOnInit() {
  
  if (this.currentUser?.is_admin) {
    await this.refreshSchedulerStatus();
  }
  
  if (this.currentUser) {
    await this.loadScheduledDownloads();
  }
  
  setInterval(() => {
    if (this.currentUser?.is_admin) {
      this.refreshSchedulerStatus();
    }
    if (this.currentUser) {
      this.loadScheduledDownloads();
    }
  }, 30000);
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
                if (response && response.readerUrls) {
                    const firstReader = response.readerUrls[0] || [];

                    this.episodes = firstReader.map((readerUrl: string, index: number) => ({
                        readerUrl: readerUrl,
                        name: `Episode-${index + 1}.mp4`,
                        selected: false,
                        episodeIndex: index
                    }));
                } else {
                    alert("Erreur: URLs des épisodes introuvables");
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