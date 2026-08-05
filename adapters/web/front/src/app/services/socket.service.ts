import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private progressSubject = new Subject<any>();
  private downloadReadySubject = new Subject<any>();
  private errorSubject = new Subject<any>();

  private uploadStartSubject = new Subject<any>();
  private uploadProgressSubject = new Subject<any>();
  private uploadCompleteSubject = new Subject<any>();

  constructor() {
    this.socket = io(environment.apiUrl);

    this.socket.on('progress', (data: any) => {
      this.progressSubject.next(data);
    });

    this.socket.on('downloadReady', (data: any) => {
      this.downloadReadySubject.next(data);
    });

    this.socket.on('error', (data: any) => {
      this.errorSubject.next(data);
    });

    this.socket.on('uploadStart', (data: any) => {
      this.uploadStartSubject.next(data);
    });

    this.socket.on('uploadProgress', (data: any) => {
      this.uploadProgressSubject.next(data);
    });

    this.socket.on('uploadComplete', (data: any) => {
      this.uploadCompleteSubject.next(data);
    });
  }

  downloadEpisode(
    urls: string | string[],
    output: string,
    clientDownloadId: string,
    userId?: number,
    animeName?: string,
    seasonName?: string,
    seasonIndex?: number,
    episodeIndex?: number,
    directDownload?: boolean
  ): void {
    this.socket.emit('downloadEpisode', {
      urls: Array.isArray(urls) ? urls : [urls],
      output,
      clientDownloadId,
      userId,
      animeName,
      seasonName,
      seasonIndex,
      episodeIndex,
      directDownload: directDownload ?? false,
    });
  }

  onDurationDetected(): Observable<{ downloadId: string, totalDuration: number }> {
    return new Observable(observer => {
      const handler = (data: { downloadId: string, totalDuration: number }) => observer.next(data);
      this.socket.on('durationDetected', handler);
      return () => this.socket.off('durationDetected', handler);
    });
  }

  onProgress(): Observable<any> {
    return this.progressSubject.asObservable();
  }

  onDownloadIdAssigned(): Observable<{ clientDownloadId: string, serverDownloadId: string, downloaderName?: string }> {
    return new Observable(observer => {
      const handler = (data: { clientDownloadId: string, serverDownloadId: string, downloaderName?: string }) => observer.next(data);
      this.socket.on('downloadIdAssigned', handler);
      return () => this.socket.off('downloadIdAssigned', handler);
    });
  }

  onDownloadReady(): Observable<any> {
    return this.downloadReadySubject.asObservable();
  }

  onError(): Observable<any> {
    return this.errorSubject.asObservable();
  }

  onUploadStart(): Observable<any> {
    return this.uploadStartSubject.asObservable();
  }

  onUploadProgress(): Observable<any> {
    return this.uploadProgressSubject.asObservable();
  }

  onUploadComplete(): Observable<any> {
    return this.uploadCompleteSubject.asObservable();
  }

  onStreamInfo(): Observable<{ downloadId: string; resolution: string; codec: string }> {
    return new Observable(observer => {
      const handler = (data: { downloadId: string; resolution: string; codec: string }) => observer.next(data);
      this.socket.on('streamInfo', handler);
      return () => this.socket.off('streamInfo', handler);
    });
  }

  reattachDownloads(downloadIds: number[]): void {
    this.socket.emit('reattachDownloads', { downloadIds });
  }

  // ─── Segmentation OP/ED d'une saison (module segmentai) ──────────────────────

  segmentSeason(payload: { userId?: number; animeName: string; seasonName: string; seasonIndex?: number }): void {
    this.socket.emit('segmentSeason', payload);
  }

  private onSegmentEvent<T>(event: string): Observable<T> {
    return new Observable<T>(observer => {
      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);
      return () => this.socket.off(event, handler);
    });
  }

  onSegmentStart(): Observable<{ animeName: string; seasonName: string }> {
    return this.onSegmentEvent('segmentStart');
  }

  onSegmentProgress(): Observable<{ animeName: string; seasonName: string; line: string }> {
    return this.onSegmentEvent('segmentProgress');
  }

  onSegmentDone(): Observable<{ animeName: string; seasonName: string }> {
    return this.onSegmentEvent('segmentDone');
  }

  onSegmentError(): Observable<{ animeName: string; seasonName: string; error: string }> {
    return this.onSegmentEvent('segmentError');
  }

  onSegmentSkipped(): Observable<{ animeName: string; seasonName: string; reason: string }> {
    return this.onSegmentEvent('segmentSkipped');
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}