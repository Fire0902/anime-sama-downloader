// socket.service.ts
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket;

  constructor() {
    this.socket = io('http://localhost:3000');
  }

  downloadEpisode(m3u8Url: string, fileName: string) {
    this.socket.emit('downloadEpisode', { m3u8Url, fileName });
  }

  onProgress(): Observable<{ current: number }> {
    return new Observable(observer => {
      this.socket.on('progress', data => observer.next(data));
    });
  }

  onDone(): Observable<{ fileName: string; data: any }> {
    return new Observable(observer => {
      this.socket.on('done', data => observer.next(data));
    });
  }

  onError(): Observable<{ message: string }> {
    return new Observable(observer => {
      this.socket.on('error', data => observer.next(data));
    });
  }
}
