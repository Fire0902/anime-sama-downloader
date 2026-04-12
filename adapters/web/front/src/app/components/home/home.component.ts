import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { of, Subject, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare global {
  interface Window {
    require?: any;
  }
}
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AnimeService, Season } from '../../services/anime.service';
import { ChangeDetectorRef } from '@angular/core';
import { SocketService } from '../../services/socket.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { HeaderComponent } from '../header/header.component';
import { AdminPanelComponent } from '../admin-panel/admin-panel.component';
import { CreateUserModalComponent } from '../create-user-modal/create-user-modal.component';
import { FavoritesPanelComponent } from '../favorites-panel/favorites-panel.component';
import { ScheduledDownloadsPanelComponent } from '../scheduled-downloads-panel/scheduled-downloads-panel.component';
import { ActiveDownloadsPanelComponent } from '../active-downloads-panel/active-downloads-panel.component';
import { DownloadHierarchyPanelComponent } from '../download-hierarchy-panel/download-hierarchy-panel.component';
import { AnimeSearchComponent } from '../anime-search/anime-search.component';
import { SeasonSelectorComponent } from '../season-selector/season-selector.component';
import { EpisodeSelectorComponent } from '../episode-selector/episode-selector.component';
import { DownloadQueuePanelComponent } from '../download-queue-panel/download-queue-panel.component';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AddFavoriteModalComponent } from '../add-favorite-modal/add-favorite-modal.component';
import { VideoModalComponent } from '../video-modal/video-modal.component';
import { FTPSettingsPanelComponent } from '../ftp-settings-panel/ftp-settings-panel.component';
import { FolderStructurePanelComponent } from '../folder-structure-panel/folder-structure-panel.component';
import { StoragePanelComponent } from '../storage-panel/storage-panel.component';
import { ZipProgressModalComponent } from '../zip-progress-modal/zip-progress-modal.component';

import {
  DownloadNode,
  Episode,
  User,
  Favorite,
  Download,
  DownloadHierarchy,
  MALResult,
} from '../../types/home.types';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    AdminPanelComponent,
    CreateUserModalComponent,
    FavoritesPanelComponent,
    ScheduledDownloadsPanelComponent,
    ActiveDownloadsPanelComponent,
    DownloadHierarchyPanelComponent,
    AnimeSearchComponent,
    SeasonSelectorComponent,
    EpisodeSelectorComponent,
    DownloadQueuePanelComponent,
    AccordionSectionComponent,
    AddFavoriteModalComponent,
    VideoModalComponent,
    FTPSettingsPanelComponent,
    FolderStructurePanelComponent,
    StoragePanelComponent,
    ZipProgressModalComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  private apiUrl = environment.apiUrl;

  // Search
  searchInput = '';
  animes: { name: string; url: string }[] = [];
  seasons: Season[] = [];
  selectedAnime: { name: string; url: string } | null = null;
  isLoadingAnimes = false;
  isLoadingSeasons = false;
  isLoadingEpisodes = false;
  episodes: Episode[] = [];
  selectedSeason: Season = { name: '', link: '' };

  // Downloads
  downloadQueue: DownloadNode[] = [];
  maxConcurrentDownloads = 3;
  downloadHierarchy: DownloadHierarchy[] = [];
  private downloadIdCounter = 0;

  // Scheduler
  schedulerStatus: any = null;
  scheduledDownloads: any[] = [];

  // Users
  @ViewChild('downloadFolderInput') downloadFolderInput?: ElementRef<HTMLInputElement>;
  currentUser: User | null = null;
  downloadPath = '';
  downloadPathMessage = '';
  downloadPathError = '';
  allUsers: User[] = [];
  showCreateUserModal = false;
  createUserForm = { username: '', email: '', password: '', is_admin: false };

  // Favorites
  favorites: Favorite[] = [];
  showAddFavoriteModal = false;
  addFavoriteForm = { animeName: '', animeUrl: '', malId: null as number | null };
  malSearchQuery = '';
  malResults: MALResult[] = [];

  // Video
  showVideoModal = false;
  currentVideoEpisode: Download | null = null;

  // Zip Progress
  showZipProgressModal = false;

  // FTP Settings
  ftpConfig: any = null;

  // UI state
  expandedSections: { [key: string]: boolean } = {
    admin: false,
    ftp: false,
    folderStructure: false,
    storage: false,
    favorites: false,
    active: true,
    downloads: false,
    queue: false,
    scheduled: false,
  };
  expandedAnimes: { [key: string]: boolean } = {};
  expandedSeasons: { [key: string]: boolean } = {};

  private searchSubject = new Subject<string>();
  private subscription = new Subscription();

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

  async ngOnInit() {
    if (this.currentUser?.is_admin) {
      await this.refreshSchedulerStatus();
    }
    if (this.currentUser) {
      await this.loadScheduledDownloads();
    }
    this.cdr.detectChanges();
    setInterval(() => {
      if (this.currentUser?.is_admin) this.refreshSchedulerStatus();
      if (this.currentUser) this.loadScheduledDownloads();
    }, 30000);
  }

  // ==================== AUTH ====================

  async loadCurrentUser() {
    try {
      const response: any = await this.http.get(`${this.apiUrl}/auth/me`).toPromise();
      this.currentUser = response.user;
      this.loadFavorites();
      this.loadDownloadHierarchy();
      this.loadDownloadPath();
      if (this.currentUser?.is_admin) this.loadAllUsers();
      this.cdr.detectChanges();
    } catch {
      this.currentUser = null;
    }
  }

  async logout() {
    try {
      await this.http.post(`${this.apiUrl}/auth/logout`, {}).toPromise();
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
      alert(error.error?.error || 'Erreur lors de la création');
    }
  }

  async deleteUser(userId: number) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    try {
      await this.http.delete(`${this.apiUrl}/admin/users/${userId}`).toPromise();
      this.loadAllUsers();
    } catch (error: any) {
      alert(error.error?.error || 'Erreur lors de la suppression');
    }
  }

  async refreshSchedulerStatus() {
    try {
      this.schedulerStatus = await this.http
        .get<any>(`${this.apiUrl}/admin/scheduler/status`)
        .toPromise();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
    }
  }

  async restartScheduler() {
    if (!confirm('Êtes-vous sûr de vouloir redémarrer le scheduler MAL ?')) return;
    try {
      await this.http.post(`${this.apiUrl}/admin/scheduler/restart`, {}).toPromise();
      alert('Le scheduler a été redémarré avec succès !');
      setTimeout(() => this.refreshSchedulerStatus(), 2000);
    } catch {
      alert('Erreur lors du redémarrage du scheduler');
    }
  }

  // ==================== FAVORITES ====================

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
      alert(error.error?.error || "Erreur lors de l'ajout");
    }
  }

  async removeFavorite(favoriteId: number) {
    if (!confirm('Retirer cet anime de vos favoris ?')) return;
    try {
      await this.http.delete(`${this.apiUrl}/favorites/${favoriteId}`).toPromise();
      this.loadFavorites();
    } catch (error) {
      console.error('Remove favorite error:', error);
    }
  }

  async checkFavoriteNow(favoriteId: number) {
    try {
      const response: any = await this.http
        .post<any>(`${this.apiUrl}/favorites/${favoriteId}/check-now`, {})
        .toPromise();
      const fav = response.favorite;
      let message = `${fav.anime_name}\n\nStatut MAL: ${fav.mal_status}\nÉpisodes sur MAL: ${fav.num_episodes}\nDerniers téléchargés: ${fav.last_downloaded}\n`;
      message +=
        fav.new_episodes_available > 0
          ? `\n${fav.new_episodes_available} nouveau(x) épisode(s) disponible(s) !`
          : '\nAucun nouvel épisode';
      if (fav.next_episode_broadcast) {
        message += `\n\nProchaine diffusion: ${fav.next_episode_broadcast.day} à ${fav.next_episode_broadcast.time} JST`;
      }
      alert(message);
      this.loadFavorites();
    } catch (error: any) {
      alert('Erreur lors de la vérification: ' + (error.error?.error || error.message));
    }
  }

  async searchMAL() {
    if (!this.malSearchQuery.trim()) return;
    try {
      const response: any = await this.http
        .get(`${this.apiUrl}/mal/search?q=${encodeURIComponent(this.malSearchQuery)}`)
        .toPromise();
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

  addToFavorites(anime: { name: string; url: string }) {
    if (!this.currentUser) {
      alert('Veuillez vous connecter pour ajouter des favoris');
      return;
    }
    this.addFavoriteForm.animeName = anime.name;
    this.addFavoriteForm.animeUrl = anime.url;
    this.showAddFavoriteModal = true;
  }

  // ==================== SCHEDULED ====================

  async loadScheduledDownloads() {
    try {
      const response: any = await this.http
        .get<any>(`${this.apiUrl}/favorites/scheduled`)
        .toPromise();
      this.scheduledDownloads = response.scheduled || [];
      this.cdr.detectChanges();
    } catch {
      this.scheduledDownloads = [];
    }
  }

  // ==================== DOWNLOAD HIERARCHY ====================

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

  isElectron: boolean = navigator.userAgent.toLowerCase().includes('electron') 
  || !!(window as any).electronAPI 
  || (window as any).process?.type === 'renderer';

  async loadDownloadPath() {
    if (!this.currentUser) return;
    try {
      const response: any = await this.http.get(`${this.apiUrl}/settings/download-path`).toPromise();
      this.downloadPath = response.downloadPath || '';
      this.downloadPathMessage = '';
      this.downloadPathError = '';
      this.cdr.detectChanges();
    } catch (error) {
      this.downloadPath = '';
    }
  }

  async selectDownloadDirectory(): Promise<void> {
    this.downloadPathMessage = '';
    this.downloadPathError = '';
    console.log('selectDownloadDirectory called');

    if (this.isElectron) {
      try {
        const selectedFolder = await (window as any).electronAPI.selectDownloadFolder();
        console.log('selectedFolder from electron:', selectedFolder);
        if (selectedFolder) {
          await this.setDownloadPath(selectedFolder);
          return;
        }
      } catch (error) {
        console.warn('Electron folder selection failed:', error);
      }
    } else if (window?.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const selectedFolder = await ipcRenderer.invoke('select-download-folder');
        console.log('selectedFolder from electron:', selectedFolder);
        if (selectedFolder) {
          await this.setDownloadPath(selectedFolder);
          return;
        }
      } catch (error) {
        console.warn('Electron folder selection failed:', error);
      }
    } else {
      console.warn('Neither electronAPI nor window.require is available');
    }

    this.downloadFolderInput?.nativeElement.click();
  }

  private async setDownloadPath(selectedFolder: string) {
    console.log('setDownloadPath called with', selectedFolder);
    try {
      const response: any = await this.http.post(`${this.apiUrl}/settings/download-path`, { downloadPath: selectedFolder }).toPromise();
      console.log('download path response', response);
      this.downloadPath = response.downloadPath;
      this.downloadPathMessage = 'Dossier de téléchargement enregistré.';
      this.downloadPathError = '';
      this.cdr.detectChanges();
    } catch (error: any) {
      this.downloadPathError = error.error?.error || 'Impossible de définir le dossier de téléchargement.';
      this.downloadPathMessage = '';
      console.error('Download path error:', error);
    }
  }

  async onDownloadDirectorySelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    console.log('onDownloadDirectorySelected called', input, files);

    if (!files || files.length === 0) {
      return;
    }

    const firstFile: any = files[0];
    const filePath = firstFile.path as string | undefined;
    const relativePath = firstFile.webkitRelativePath as string | undefined;

    if (!filePath) {
      this.downloadPathError = 'Impossible de récupérer le chemin du dossier. Utilisez l’application Electron.';
      return;
    }

    let selectedFolder = filePath;
    if (relativePath) {
      selectedFolder = filePath.slice(0, filePath.length - relativePath.length);
      if (selectedFolder.endsWith('/') || selectedFolder.endsWith('\\')) {
        selectedFolder = selectedFolder.slice(0, -1);
      }
    } else {
      const separator = filePath.includes('\\') ? '\\' : '/';
      selectedFolder = filePath.split(separator).slice(0, -1).join(separator);
    }

    try {
      const response: any = await this.http.post(`${this.apiUrl}/settings/download-path`, { downloadPath: selectedFolder }).toPromise();
      this.downloadPath = response.downloadPath;
      this.downloadPathMessage = 'Dossier de téléchargement enregistré.';
      this.downloadPathError = '';
      this.cdr.detectChanges();
    } catch (error: any) {
      this.downloadPathError = error.error?.error || 'Impossible de définir le dossier de téléchargement.';
      this.downloadPathMessage = '';
      console.error('Download path error:', error);
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  async zipAnime(animeName: string) {
    this.showZipProgressModal = true;
    this.cdr.detectChanges();
    try {
      const blob = await this.http
        .post(`${this.apiUrl}/downloads/zip/anime`, { animeName }, { responseType: 'blob' })
        .toPromise();
      this.showZipProgressModal = false;
      this.cdr.detectChanges();
      this.triggerBlobDownload(blob as Blob, `${animeName}.zip`);
    } catch (error) {
      this.showZipProgressModal = false;
      this.cdr.detectChanges();
      alert('Erreur lors de la création du ZIP');
    }
  }

  async zipSeason(payload: { anime: string; season: string }) {
    this.showZipProgressModal = true;
    this.cdr.detectChanges();
    try {
      const blob = await this.http
        .post(
          `${this.apiUrl}/downloads/zip/season`,
          { animeName: payload.anime, seasonName: payload.season },
          { responseType: 'blob' }
        )
        .toPromise();
      this.showZipProgressModal = false;
      this.cdr.detectChanges();
      this.triggerBlobDownload(blob as Blob, `${payload.anime}_${payload.season}.zip`);
    } catch (error) {
      this.showZipProgressModal = false;
      this.cdr.detectChanges();
      alert('Erreur lors de la création du ZIP');
    }
  }

  async deleteDownload(downloadId: string) {
    if (!confirm('Supprimer ce téléchargement ?')) return;
    try {
      await this.http.delete(`${this.apiUrl}/downloads/${downloadId}`).toPromise();
      this.loadDownloadHierarchy();
    } catch (error) {
      console.error('Delete download error:', error);
    }
  }

  downloadEpisode(episode: Download) {
    window.open(`${this.apiUrl}/downloads/${episode.id}`, '_blank');
  }

  playVideo(episode: Download) {
    this.currentVideoEpisode = episode;
    this.showVideoModal = true;
  }

  closeVideoModal() {
    this.showVideoModal = false;
    this.currentVideoEpisode = null;
  }

  private triggerBlobDownload(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // ==================== DOWNLOAD QUEUE ====================

  addToDownloadQueue(readerUrl: string, fileName: string, episodeName: string) {
    const downloadId = `download-${++this.downloadIdCounter}`;
    const downloadNode: DownloadNode = {
      id: downloadId,
      name: episodeName,
      animeName: this.selectedAnime?.name || '',
      seasonName: this.selectedSeason?.name || '',
      fileName,
      m3u8Url: readerUrl,
      downloadState: 'queued',
      progress: 0,
      estimatedDuration: 0,
      progressPercent: 0,
      fileSize: 0,
      downloadUrl: '',
      downloadSubscription: null,
    };
    this.downloadQueue.push(downloadNode);
    this.cdr.detectChanges();
    this.processQueue();
  }

  private processQueue() {
    const active = this.downloadQueue.filter(
      (d) => d.downloadState === 'downloading' || d.downloadState === 'encoding'
    );
    if (active.length >= this.maxConcurrentDownloads) return;
    const slots = this.maxConcurrentDownloads - active.length;
    this.downloadQueue
      .filter((d) => d.downloadState === 'queued')
      .slice(0, slots)
      .forEach((d) => this.startDownload(d));
  }

  private startDownload(node: DownloadNode) {
    node.downloadState = 'downloading';
    node.downloadSubscription = new Subscription();
    this.cdr.detectChanges();

    const userId = this.currentUser?.id;
    const animeName = node.animeName || 'unknown';
    const seasonName = node.seasonName || 'unknown';

    this.socketService.downloadEpisode(node.m3u8Url, node.fileName, node.id, userId, animeName, seasonName);

    node.downloadSubscription.add(
      this.socketService.onDownloadIdAssigned().subscribe(({ clientDownloadId, serverDownloadId, downloaderName }) => {
        if (clientDownloadId === node.id) {
          node.id = serverDownloadId;
          node.downloaderName = downloaderName;
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onDurationDetected().subscribe(({ downloadId, totalDuration }) => {
        if (downloadId === node.id) {
          node.estimatedDuration = totalDuration;
          if (this.isSizeBasedDownload(node) && node.progress > 0) {
            node.progressPercent = Math.min(
              Math.round((node.progress / node.estimatedDuration) * 100),
              99
            );
          }
          this.cdr.detectChanges();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onProgress().subscribe((data) => {
        if (data.downloadId === node.id) {
          node.progress = data.current;
          node.downloadState = 'encoding';
          if (this.isSizeBasedDownload(node)) {
            if (node.estimatedDuration > 0) {
              node.progressPercent = Math.min(
                Math.round((node.progress / node.estimatedDuration) * 100),
                99
              );
            }
          } else {
            if (node.progress > 30 && node.estimatedDuration === 0) {
              node.estimatedDuration = node.progress * 1.1;
            }
            if (node.estimatedDuration > 0) {
              node.progressPercent = Math.min(
                Math.round((node.progress / node.estimatedDuration) * 100),
                99
              );
            }
          }
          this.cdr.detectChanges();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onDownloadReady().subscribe(({ downloadUrl, fileName, fileSize, downloadId }) => {
        if (downloadId === node.id) {
          node.downloadState = 'ready';
          node.progressPercent = 100;
          node.fileSize = fileSize;
          node.downloadUrl = downloadUrl;
          this.loadDownloadHierarchy();
          this.cdr.detectChanges();
          this.processQueue();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onError().subscribe((err) => {
        if (err.downloadId === node.id) {
          node.downloadState = 'error';
          node.errorMessage = err.message;
          this.cdr.detectChanges();
          this.processQueue();
        }
      })
    );
  }

  private isSizeBasedDownload(node: DownloadNode): boolean {
    return node.downloaderName === 'Sibnet' || node.estimatedDuration > 1024 * 1024;
  }

  removeDownload(node: DownloadNode) {
    node.downloadSubscription?.unsubscribe();
    const i = this.downloadQueue.indexOf(node);
    if (i > -1) this.downloadQueue.splice(i, 1);
    this.cdr.detectChanges();
    this.processQueue();
  }

  getActiveDownloads(): DownloadNode[] {
    return this.downloadQueue.filter(
      (d) => d.downloadState === 'downloading' || d.downloadState === 'encoding'
    );
  }

  getQueuedDownloads(): DownloadNode[] {
    return this.downloadQueue.filter((d) => d.downloadState === 'queued');
  }

  getErroredDownloads(): DownloadNode[] {
    return this.downloadQueue.filter((d) => d.downloadState === 'error');
  }

  clearErroredDownloads(): void {
    this.downloadQueue = this.downloadQueue.filter((d) => d.downloadState !== 'error');
    this.cdr.detectChanges();
  }

  // ==================== SEARCH ====================

  private initSearchSubscription(): void {
    const sub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          if (!value.trim()) {
            this.animes = [];
            this.seasons = [];
            this.cdr.detectChanges();
            return of(null);
          }
          this.isLoadingAnimes = true;
          this.cdr.detectChanges();
          return this.animeService.searchAnimes(value);
        })
      )
      .subscribe({
        next: (response) => {
          this.isLoadingAnimes = false;
          this.animes = response?.animesTitle
            ? Object.entries(response.animesTitle).map(([name, url]) => ({ name, url: url as string }))
            : [];
          this.seasons = [];
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoadingAnimes = false;
          this.animes = [];
          this.cdr.detectChanges();
        },
      });
    this.subscription.add(sub);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput = value;
    this.searchSubject.next(value);
    this.cdr.detectChanges();
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
        if (response?.animeSeasons) {
          this.seasons = response.animeSeasons.map((s: Season) => ({
            ...s,
            link: `${anime.url}${s.link}`,
          }));
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingSeasons = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectSeason(season: Season): void {
    if (!this.selectedAnime) return;
    this.selectedSeason = season;
    this.isLoadingEpisodes = true;
    this.animeService.getEpisodes(season.link).subscribe({
      next: (response) => {
        if (response?.readerUrls) {
          const firstReader = response.readerUrls[0] || [];
          this.episodes = firstReader.map((readerUrl: string, index: number) => ({
            readerUrl,
            name: `Episode ${index + 1}.mp4`,
            selected: false,
            episodeIndex: index,
          }));
        } else {
          alert('Erreur: URLs des épisodes introuvables');
        }
        this.isLoadingEpisodes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingEpisodes = false;
        alert('Erreur lors de la récupération des épisodes');
        this.cdr.detectChanges();
      },
    });
  }

  clearSearch(): void {
    this.searchInput = '';
    this.animes = [];
    this.seasons = [];
    this.selectedAnime = null;
    this.episodes = [];
  }

  // ==================== EPISODES ====================

  toggleEpisode(episode: Episode): void {
    episode.selected = !episode.selected;
  }

  toggleAllEpisodes(): void {
    const allSelected = this.episodes.every((ep) => ep.selected);
    this.episodes.forEach((ep) => (ep.selected = !allSelected));
  }

  validateDownloads(): void {
    if (!this.currentUser) {
      alert('Veuillez vous connecter pour télécharger');
      return;
    }
    const selected = this.episodes.filter((ep) => ep.selected);
    if (!selected.length) {
      alert('Veuillez sélectionner au moins un épisode');
      return;
    }
    selected.forEach((ep) => this.addToDownloadQueue(ep.readerUrl, ep.name, ep.name));
    this.episodes.forEach((ep) => (ep.selected = false));
  }

  // ==================== UI ====================

  toggleSection(section: string) {
    this.expandedSections[section] = !this.expandedSections[section];
    this.cdr.detectChanges();
  }

  toggleAnime(animeName: string) {
    this.expandedAnimes[animeName] = !this.expandedAnimes[animeName];
    this.cdr.detectChanges();
  }

  toggleSeason(animeName: string, seasonName: string) {
    const key = `${animeName}/${seasonName}`;
    this.expandedSeasons[key] = !this.expandedSeasons[key];
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.downloadQueue.forEach((d) => d.downloadSubscription?.unsubscribe());
  }
}