import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { SocketService } from './socket.service';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { DownloadNode } from '../types/home.types';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DownloadStateService {
  private apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;
  private _queue: DownloadNode[] = [];
  private queueSubject = new BehaviorSubject<DownloadNode[]>([]);
  readonly downloadQueue$ = this.queueSubject.asObservable();
  readonly downloadReady$ = new Subject<void>();

  maxConcurrentDownloads = parseInt(localStorage.getItem('maxConcurrentDownloads') || '3', 10);
  private downloadIdCounter = 0;

  constructor(
    private socketService: SocketService,
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.socketService.onStreamInfo().subscribe(({ downloadId, resolution, codec }) => {
      const node = this._queue.find(d => String(d.id) === String(downloadId));
      if (node) { node.streamInfo = { resolution, codec }; this.notify(); }
    });
  }

  get downloadQueue(): DownloadNode[] {
    return this._queue;
  }

  private notify() {
    this.queueSubject.next([...this._queue]);
  }

  getActiveDownloads(): DownloadNode[] {
    return this._queue.filter(d => d.downloadState === 'downloading' || d.downloadState === 'encoding');
  }

  getQueuedDownloads(): DownloadNode[] {
    return this._queue.filter(d => d.downloadState === 'queued');
  }

  getErroredDownloads(): DownloadNode[] {
    return this._queue.filter(d => d.downloadState === 'error');
  }

  addToDownloadQueue(
    readerUrl: string,
    fileName: string,
    episodeName: string,
    animeName: string,
    seasonName: string,
    urls?: string[],
    episodeIndex?: number,
    seasonIndex?: number,
    directDownload?: boolean
  ) {
    const downloadId = `download-${++this.downloadIdCounter}`;
    const node: DownloadNode = {
      id: downloadId,
      name: episodeName,
      animeName,
      seasonName,
      fileName,
      m3u8Url: readerUrl,
      urls: urls || [readerUrl],
      directDownload: directDownload ?? false,
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
    this._queue.push(node);
    this.notify();
    this.processQueue();
  }

  processQueue() {
    const active = this.getActiveDownloads();
    if (active.length >= this.maxConcurrentDownloads) return;
    const slots = this.maxConcurrentDownloads - active.length;
    this._queue
      .filter(d => d.downloadState === 'queued')
      .slice(0, slots)
      .forEach(d => this.startDownload(d));
  }

  private startDownload(node: DownloadNode) {
    node.downloadState = 'downloading';
    node.downloadSubscription = new Subscription();
    this.notify();

    const userId = this.authService.getCurrentUser()?.id;
    const urls = node.urls || [node.m3u8Url];

    this.socketService.downloadEpisode(urls, node.fileName, node.id, userId, node.animeName, node.seasonName, node.seasonIndex, node.episodeIndex, node.directDownload);

    node.downloadSubscription.add(
      this.socketService.onDownloadIdAssigned().subscribe(({ clientDownloadId, serverDownloadId, downloaderName }) => {
        if (String(clientDownloadId) === String(node.id)) {
          node.id = String(serverDownloadId);
          node.downloaderName = downloaderName;
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onDurationDetected().subscribe(({ downloadId, totalDuration }) => {
        if (String(downloadId) === String(node.id)) {
          node.estimatedDuration = totalDuration;
          if (this.isSizeBasedDownload(node) && node.progress > 0) {
            node.progressPercent = Math.min(Math.round((node.progress / node.estimatedDuration) * 100), 99);
          }
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onProgress().subscribe((data) => {
        if (String(data.downloadId) === String(node.id)) {
          node.progress = data.current;
          node.downloadState = 'encoding';
          if (this.isSizeBasedDownload(node)) {
            if (node.estimatedDuration > 0) {
              node.progressPercent = Math.min(Math.round((node.progress / node.estimatedDuration) * 100), 99);
            }
          } else {
            if (node.progress > 30 && node.estimatedDuration === 0) {
              node.estimatedDuration = node.progress * 1.1;
            }
            if (node.estimatedDuration > 0) {
              node.progressPercent = Math.min(Math.round((node.progress / node.estimatedDuration) * 100), 99);
            }
          }
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onDownloadReady().subscribe(({ downloadUrl, fileSize, downloadId }) => {
        if (String(downloadId) === String(node.id)) {
          node.downloadState = 'ready';
          node.progressPercent = 100;
          node.fileSize = fileSize;
          node.downloadUrl = downloadUrl;
          this.downloadReady$.next();
          this.notify();
          this.processQueue();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onError().subscribe((err) => {
        if (String(err.downloadId) === String(node.id)) {
          node.downloadState = 'error';
          node.errorMessage = err.message;
          this.notify();
          this.processQueue();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadStart().subscribe((data) => {
        if (String(data.downloadId) === String(node.id)) {
          node.ftpStatus = 'uploading';
          node.ftpProgress = 0;
          node.ftpTotal = data.fileSize || 0;
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadProgress().subscribe((data) => {
        if (String(data.downloadId) === String(node.id)) {
          node.ftpProgress = data.current;
          node.ftpTotal = data.total || node.ftpTotal;
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadComplete().subscribe((data) => {
        if (String(data.downloadId) === String(node.id)) {
          node.ftpStatus = 'completed';
          this.notify();
        }
      })
    );
  }

  reattachDownload(node: DownloadNode) {
    node.downloadSubscription = new Subscription();

    node.downloadSubscription.add(
      this.socketService.onDurationDetected().subscribe(({ downloadId, totalDuration }) => {
        if (String(downloadId) === String(node.id)) {
          node.estimatedDuration = totalDuration;
          if (node.progress > 0 && node.estimatedDuration > 0) {
            node.progressPercent = Math.min(Math.round((node.progress / node.estimatedDuration) * 100), 99);
          }
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onProgress().subscribe((data) => {
        if (String(data.downloadId) === String(node.id)) {
          node.progress = data.current;
          node.downloadState = 'encoding';
          if (data.totalDuration && data.totalDuration > 0 && node.estimatedDuration === 0) {
            node.estimatedDuration = data.totalDuration;
          }
          if (node.estimatedDuration > 0) {
            node.progressPercent = Math.min(Math.round((node.progress / node.estimatedDuration) * 100), 99);
          }
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onDownloadReady().subscribe(({ downloadUrl, fileSize, downloadId }) => {
        if (String(downloadId) === String(node.id)) {
          node.downloadState = 'ready';
          node.progressPercent = 100;
          node.fileSize = fileSize;
          node.downloadUrl = downloadUrl;
          this.downloadReady$.next();
          this.notify();
          this.processQueue();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onError().subscribe((err) => {
        if (String(err.downloadId) === String(node.id)) {
          node.downloadState = 'error';
          node.errorMessage = err.message;
          this.notify();
          this.processQueue();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadStart().subscribe((data) => {
        if (String(data.downloadId) === String(node.id)) {
          node.ftpStatus = 'uploading';
          node.ftpProgress = 0;
          node.ftpTotal = data.fileSize || 0;
          this.notify();
        }
      })
    );

    node.downloadSubscription.add(
      this.socketService.onUploadComplete().subscribe((data) => {
        if (String(data.downloadId) === String(node.id)) {
          node.ftpStatus = 'completed';
          this.notify();
        }
      })
    );
  }

  async loadErroredDownloads() {
    try {
      const res: any = await this.http.get(`${this.apiUrl}/downloads/errors`).toPromise();
      const errors: any[] = res?.downloads ?? [];
      if (!errors.length) return;
      errors.forEach(d => {
        const id = String(d.id);
        if (this._queue.find(n => String(n.id) === id)) return;
        this._queue.push({
          id,
          name: d.episode_name,
          animeName: d.anime_name,
          seasonName: d.season_name ?? '',
          fileName: d.episode_name,
          m3u8Url: '',
          urls: [],
          downloadState: 'error',
          errorMessage: d.error_message ?? 'Erreur inconnue',
          progress: 0,
          estimatedDuration: 0,
          progressPercent: 0,
          fileSize: d.file_size || 0,
          downloadUrl: '',
          downloadSubscription: null,
        });
      });
      this.notify();
    } catch (error) {
      console.error('Error loading errored downloads:', error);
    }
  }

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
        if (this._queue.find(n => String(n.id) === String(d.id))) return;
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
          progressPercent: 0,
          fileSize: d.file_size || 0,
          downloadUrl: '',
          downloadSubscription: null,
        };
        this._queue.push(node);
        this.reattachDownload(node);
      });
      this.notify();
    } catch (error) {
      console.error('Error loading in-progress downloads:', error);
    }
  }

  removeDownload(node: DownloadNode) {
    node.downloadSubscription?.unsubscribe();
    if (node.downloadState === 'error' && /^\d+$/.test(node.id)) {
      this.http.delete(`${this.apiUrl}/downloads/${node.id}`).subscribe({
        error: err => console.error('Error deleting errored download from DB:', err),
      });
    }
    const i = this._queue.indexOf(node);
    if (i > -1) this._queue.splice(i, 1);
    this.notify();
    this.processQueue();
  }

  retryDownload(node: DownloadNode) {
    node.downloadSubscription?.unsubscribe();
    if (/^\d+$/.test(node.id)) {
      this.http.delete(`${this.apiUrl}/downloads/${node.id}`).subscribe({
        error: err => console.error('Error deleting errored download from DB:', err),
      });
    }
    node.id = `download-${++this.downloadIdCounter}`;
    node.downloadState = 'queued';
    node.errorMessage = undefined;
    node.progress = 0;
    node.progressPercent = 0;
    node.estimatedDuration = 0;
    node.downloadSubscription = null;
    this.notify();
    this.processQueue();
  }

  clearErroredDownloads() {
    this.http.delete(`${this.apiUrl}/downloads/errors`).subscribe({
      error: err => console.error('Error clearing errored downloads from DB:', err),
    });
    this._queue = this._queue.filter(d => d.downloadState !== 'error');
    this.notify();
  }

  downloadErrorLog() {
    const errors = this.getErroredDownloads();
    if (!errors.length) return;
    const lines = errors.map(err => [
      `[ERREUR]`,
      err.animeName ? `Anime      : ${err.animeName}` : null,
      err.seasonName ? `Saison     : ${err.seasonName}` : null,
      `Épisode    : ${err.name}`,
      err.downloaderName ? `Téléchargeur: ${err.downloaderName}` : null,
      `Message    : ${err.errorMessage || 'Erreur inconnue'}`,
    ].filter(Boolean).join('\n'));
    const content = lines.join('\n\n' + '-'.repeat(50) + '\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erreurs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  onMaxConcurrentChange(value: number) {
    this.maxConcurrentDownloads = value;
    localStorage.setItem('maxConcurrentDownloads', String(value));
    this.processQueue();
  }

  private isSizeBasedDownload(node: DownloadNode): boolean {
    return node.downloaderName === 'Sibnet' || node.estimatedDuration > 1024 * 1024;
  }
}
