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
import { AnimeService, Season, type Provider } from '../../services/anime.service';
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
import { JellyseerrPanelComponent } from '../jellyseerr-panel/jellyseerr-panel.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';
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
    JellyseerrPanelComponent,
    SettingsPanelComponent,
    ZipProgressModalComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  private apiUrl = environment.apiUrl;

  // Search
  searchInput = '';
  selectedProvider: Provider = 'anime-sama';
  animes: { name: string; url: string }[] = [];
  seasons: Season[] = [];
  selectedAnime: { name: string; url: string } | null = null;
  isLoadingAnimes = false;
  isLoadingSeasons = false;
  isLoadingEpisodes = false;
  episodes: Episode[] = [];
  selectedSeason: Season = { name: '', link: '' };

  // Manual M3U8
  m3u8Url = '';
  m3u8AnimeName = '';
  m3u8SeasonName = 'Saison 1';
  m3u8EpisodeName = '';
  m3u8GuessIndex = true;
  m3u8ManualIndex = 1;
  m3u8UploadedFileName = '';
  m3u8IsUploading = false;

  // Downloads
  downloadQueue: DownloadNode[] = [];
  maxConcurrentDownloads = parseInt(localStorage.getItem('maxConcurrentDownloads') || '3', 10);
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
    jellyseerr: false,
    settings: false,
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
      this.loadInProgressDownloads();
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

  searchFromJellyseerr(title: string) {
    this.searchInput = title;
    this.searchSubject.next(title);
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

  async loadInProgressDownloads() {
    try {
      const [downloadsRes, activeRes]: any[] = await Promise.all([
        this.http.get(`${this.apiUrl}/downloads`).toPromise(),
        this.http.get(`${this.apiUrl}/downloads/active-ids`).toPromise(),
      ]);
      const activeIds: string[] = (activeRes?.ids ?? []).map(String);
      const inProgress: any[] = (downloadsRes?.downloads ?? []).filter(
        (d: any) => activeIds.includes(String(d.id))
      );
      if (!inProgress.length) return;

      this.socketService.reattachDownloads(inProgress.map((d: any) => Number(d.id)));

      inProgress.forEach((d: any) => {
        if (this.downloadQueue.find(n => n.id === String(d.id))) return;
        const node: DownloadNode = {
          id: String(d.id),
          name: d.episode_name,
          animeName: d.anime_name,
          seasonName: d.season_name ?? '',
          fileName: d.episode_name,
          m3u8Url: '',
          urls: [],
          downloadState: d.status as 'downloading' | 'encoding',
          progress: d.progress || 0,
          estimatedDuration: 0,
          progressPercent: d.progress || 0,
          fileSize: d.file_size || 0,
          downloadUrl: '',
          downloadSubscription: null,
        };
        this.downloadQueue.push(node);
        this.reattachDownload(node);
      });
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading in-progress downloads:', error);
    }
  }

  addToDownloadQueue(readerUrl: string, fileName: string, episodeName: string, urls?: string[], episodeIndex?: number, seasonIndex?: number) {    const downloadId = `download-${++this.downloadIdCounter}`;
    console.log(`[QUEUE] Adding: "${episodeName}", seasonIndex: ${seasonIndex}, episodeIndex: ${episodeIndex}`);
    const downloadNode: DownloadNode = {
      id: downloadId,
      name: episodeName,
      animeName: this.selectedAnime?.name || '',
      seasonName: this.selectedSeason?.name || '',
      fileName,
      m3u8Url: readerUrl,
      urls: urls || [readerUrl],
      seasonIndex: seasonIndex || 0,
      episodeIndex: episodeIndex || 0,
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
    const urls = node.urls || [node.m3u8Url];
    const seasonIndex = node.seasonIndex ?? 0;
    const episodeIndex = node.episodeIndex ?? 0;

    this.socketService.downloadEpisode(urls, node.fileName, node.id, userId, animeName, seasonName, seasonIndex, episodeIndex);

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

    node.downloadSubscription.add(
      this.socketService.onUploadStart().subscribe((data) => {
        if (data.downloadId === node.id) {
          node.ftpStatus = 'uploading';
          node.ftpProgress = 0;
          node.ftpTotal = data.fileSize || 0;
          console.log(`[FTP] Upload started for ${node.id}: ${node.ftpTotal} bytes`);
          this.cdr.detectChanges();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadProgress().subscribe((data) => {
        if (data.downloadId === node.id) {
          node.ftpProgress = data.current;
          node.ftpTotal = data.total || node.ftpTotal;
          this.cdr.detectChanges();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadComplete().subscribe((data) => {
        if (data.downloadId === node.id) {
          node.ftpStatus = 'completed';
          console.log(`[FTP] Upload completed for ${node.id}`);
          this.cdr.detectChanges();
        }
      })
    );
  }

  private isSizeBasedDownload(node: DownloadNode): boolean {
    return node.downloaderName === 'Sibnet' || node.estimatedDuration > 1024 * 1024;
  }

  private reattachDownload(node: DownloadNode) {
    node.downloadSubscription = new Subscription();

    node.downloadSubscription.add(
      this.socketService.onProgress().subscribe((data) => {
        if (data.downloadId === node.id) {
          node.progress = data.current;
          node.downloadState = 'encoding';
          if (node.estimatedDuration > 0) {
            node.progressPercent = Math.min(Math.round((node.progress / node.estimatedDuration) * 100), 99);
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

    node.downloadSubscription.add(
      this.socketService.onUploadStart().subscribe((data) => {
        if (data.downloadId === node.id) {
          node.ftpStatus = 'uploading';
          node.ftpProgress = 0;
          node.ftpTotal = data.fileSize || 0;
          this.cdr.detectChanges();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadComplete().subscribe((data) => {
        if (data.downloadId === node.id) {
          node.ftpStatus = 'completed';
          this.cdr.detectChanges();
        }
      })
    );
  }

  onMaxConcurrentChange(value: number) {
    this.maxConcurrentDownloads = value;
    this.processQueue();
  }

  removeDownload(node: DownloadNode) {
    node.downloadSubscription?.unsubscribe();
    const i = this.downloadQueue.indexOf(node);
    if (i > -1) this.downloadQueue.splice(i, 1);
    this.cdr.detectChanges();
    this.processQueue();
  }

  retryDownload(node: DownloadNode) {
    node.downloadSubscription?.unsubscribe();
    node.id = `download-${++this.downloadIdCounter}`;
    node.downloadState = 'queued';
    node.errorMessage = undefined;
    node.progress = 0;
    node.progressPercent = 0;
    node.estimatedDuration = 0;
    node.downloadSubscription = null;
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

  downloadErrorLog(): void {
    const errors = this.getErroredDownloads();
    if (!errors.length) return;

    const lines = errors.map(err => {
      return [
        `[ERREUR]`,
        err.animeName  ? `Anime      : ${err.animeName}`         : null,
        err.seasonName ? `Saison     : ${err.seasonName}`        : null,
        `Épisode    : ${err.name}`,
        err.downloaderName ? `Téléchargeur: ${err.downloaderName}` : null,
        `Message    : ${err.errorMessage || 'Erreur inconnue'}`,
      ].filter(Boolean).join('\n');
    });

    const content = lines.join('\n\n' + '-'.repeat(50) + '\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erreurs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  onM3U8FileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.m3u8IsUploading = true;
    this.m3u8UploadedFileName = file.name;
    this.cdr.detectChanges();

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      this.animeService.uploadM3U8File(content).subscribe({
        next: (res) => {
          this.m3u8Url = res.filePath;
          this.m3u8IsUploading = false;
          // Pre-fill episode name from filename if empty
          if (!this.m3u8EpisodeName) {
            this.m3u8EpisodeName = file.name.replace(/\.m3u8$/i, '');
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          alert('Erreur lors de l\'upload du fichier m3u8 : ' + (err.error?.error || err.message));
          this.m3u8IsUploading = false;
          this.m3u8UploadedFileName = '';
          input.value = '';
          this.cdr.detectChanges();
        },
      });
    };
    reader.readAsText(file);
  }

  // ==================== M3U8 MANUEL ====================

  guessEpisodeIndex(name: string): number {
    const numbers = name.match(/\d+/g);
    if (!numbers || numbers.length === 0) return 0;
    return parseInt(numbers[numbers.length - 1], 10);
  }

  downloadFromM3U8(): void {
    if (!this.currentUser) {
      alert('Veuillez vous connecter pour télécharger');
      return;
    }
    const url = this.m3u8Url.trim();
    const animeName = this.m3u8AnimeName.trim();
    const episodeName = this.m3u8EpisodeName.trim();
    if (!url || !animeName || !episodeName) {
      alert('URL m3u8, nom d\'anime et nom d\'épisode sont requis');
      return;
    }

    const episodeIndex = this.m3u8GuessIndex
      ? this.guessEpisodeIndex(episodeName)
      : this.m3u8ManualIndex;

    const fileName = episodeName.endsWith('.mp4') ? episodeName : `${episodeName}.mp4`;
    const seasonName = this.m3u8SeasonName.trim() || 'Saison 1';

    // Temporarily override selection context for addToDownloadQueue
    const savedAnime = this.selectedAnime;
    const savedSeason = this.selectedSeason;
    this.selectedAnime = { name: animeName, url: '' };
    this.selectedSeason = { name: seasonName, link: '' };

    this.addToDownloadQueue(url, fileName, fileName, [url], episodeIndex, 0);

    this.selectedAnime = savedAnime;
    this.selectedSeason = savedSeason;
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
          return this.animeService.searchAnimes(value, this.selectedProvider);
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

    this.animeService.getSeasons(anime.url, this.selectedProvider).subscribe({
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

    // Calculate season index based on selected season position
    const seasonIndex = this.seasons.findIndex(s => s.name === season.name);
    console.log(`[SEASON] Selected: "${season.name}", seasonIndex: ${seasonIndex}, total seasons: ${this.seasons.length}`);
    console.log(`[SEASON] All seasons:`, this.seasons.map((s, i) => `${i}:"${s.name}"`));

    this.animeService.getEpisodes(season.link, this.selectedProvider).subscribe({
      next: (response) => {
        if (response?.readerUrls && response.readerUrls.length > 0) {
          // Calculate season index based on selected season position
          const seasonIndex = this.seasons.findIndex(s => s.name === season.name);

          // readerUrls is an array of 3 arrays, each array has URLs for one source
          const maxEpisodes = response.readerUrls[0]?.length || 0;
          const episodeNames = response.episodeNames || [];

          this.episodes = [];
          for (let i = 0; i < maxEpisodes; i++) {
            const urls = response.readerUrls
              .map((sourceArray: string[]) => sourceArray[i])
              .filter((url: string) => url && url.trim());

            if (urls.length > 0) {
              // Use episode names from scraper if available, otherwise default to Episode X
              const name = episodeNames[i] || `Episode-${i + 1}.mp4`;
              const rawFileName = name.endsWith('.mp4') ? name : `${name}.mp4`;
              const fileName = rawFileName.replace(/^Episode (\d)/i, 'Episode-$1');

              this.episodes.push({
                readerUrl: urls[0],  // Keep first for backward compatibility
                urls: urls,          // But also store all 3
                name: fileName,
                selected: false,
                episodeIndex: i,
                seasonIndex: seasonIndex,
              });
            }
          }
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

  onProviderChange(provider: Provider): void {
    this.selectedProvider = provider;
    this.clearSearch();
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
    selected.forEach((ep) => this.addToDownloadQueue(ep.readerUrl, ep.name, ep.name, ep.urls, ep.episodeIndex, ep.seasonIndex));
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