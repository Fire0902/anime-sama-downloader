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
    episodeIndex?: number
  ): void {
    this.socket.emit('downloadEpisode', {
      urls: Array.isArray(urls) ? urls : [urls],
      output,
      clientDownloadId,
      userId,
      animeName,
      seasonName,
      seasonIndex,
      episodeIndex
    });
  }

  onDurationDetected(): Observable<{ downloadId: string, totalDuration: number }> {
    return new Observable(observer => {
      this.socket.on('durationDetected', (data: { downloadId: string, totalDuration: number }) => {
        observer.next(data);
      });
    });
  }

  onProgress(): Observable<any> {
    return this.progressSubject.asObservable();
  }

  onDownloadIdAssigned(): Observable<{ clientDownloadId: string, serverDownloadId: string, downloaderName?: string }> {
    return new Observable(observer => {
      this.socket.on('downloadIdAssigned', (data: { clientDownloadId: string, serverDownloadId: string, downloaderName?: string }) => {
        observer.next(data);
      });
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

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}