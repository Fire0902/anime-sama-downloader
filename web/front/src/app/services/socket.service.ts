import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
    private socket: Socket;

    constructor() {
        this.socket = io('http://localhost:3000', {
            transports: ['websocket', 'polling']
        });
        
        this.socket.on('connect', () => {
            console.log('Socket connecté:', this.socket.id);
        });
    }

    downloadEpisode(m3u8Url: string, fileName: string, downloadId: string) {
        console.log("Émission de downloadEpisode:", { m3u8Url, output: fileName, downloadId });
        this.socket.emit('downloadEpisode', { m3u8Url, output: fileName, downloadId });
    }

    onProgress(): Observable<{ current: number; downloadId: string }> {
        return new Observable(observer => {
            this.socket.on('progress', data => observer.next(data));
        });
    }

    onDownloadReady(): Observable<{ downloadId: string; fileName: string; fileSize: number; downloadUrl: string }> {
        return new Observable(observer => {
            this.socket.on('downloadReady', data => observer.next(data));
        });
    }

    onError(): Observable<{ message: string; downloadId: string }> {
        return new Observable(observer => {
            this.socket.on('error', data => observer.next(data));
        });
    }
}