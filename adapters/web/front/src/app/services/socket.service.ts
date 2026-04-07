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
  }

  downloadEpisode(
    readerUrl: string,
    output: string,
    clientDownloadId: string,
    userId?: number,
    animeName?: string,
    seasonName?: string
  ): void {
    this.socket.emit('downloadEpisode', {
      readerUrl,
      output,
      clientDownloadId,
      userId,
      animeName,
      seasonName
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

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}