import {
  Component, Input, Output, EventEmitter, OnChanges, OnDestroy, HostListener,
  ViewChild, ElementRef, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Download } from '../../types/home.types';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-video-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-modal.component.html',
})
export class VideoModalComponent implements OnChanges, OnDestroy {
  @Input() episode: Download | null = null;
  /** All episodes in the current season/context, in order */
  @Input() playlist: Download[] = [];

  @Output() onClose = new EventEmitter<void>();

  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  readonly apiUrl = environment.apiUrl;

  currentIndex = 0;
  currentEpisode: Download | null = null;
  sidebarOpen = true;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['episode'] || changes['playlist']) {
      this.currentIndex = this.playlist.findIndex(e => e.id === this.episode?.id);
      if (this.currentIndex < 0) this.currentIndex = 0;
      this.currentEpisode = this.playlist[this.currentIndex] ?? this.episode;
    }
  }

  get hasPrev() { return this.currentIndex > 0; }
  get hasNext() { return this.currentIndex < this.playlist.length - 1; }

  goTo(index: number) {
    if (index < 0 || index >= this.playlist.length) return;
    this.currentIndex = index;
    this.currentEpisode = this.playlist[index];
    setTimeout(() => this.videoRef?.nativeElement?.play(), 50);
  }

  prev() { this.goTo(this.currentIndex - 1); }
  next() { this.goTo(this.currentIndex + 1); }

  onVideoEnded() {
    if (this.hasNext) this.next();
  }

  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }

  videoUrl(ep: Download) {
    return `${this.apiUrl}/downloads/${ep.id}`;
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    switch (e.key) {
      case 'Escape': this.onClose.emit(); break;
      case ' ':
      case 'k':
        e.preventDefault();
        video.paused ? video.play() : video.pause();
        break;
      case 'ArrowRight':
      case 'l':
        e.preventDefault();
        video.currentTime = Math.min(video.currentTime + 10, video.duration);
        break;
      case 'ArrowLeft':
      case 'j':
        e.preventDefault();
        video.currentTime = Math.max(video.currentTime - 10, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(video.volume + 0.1, 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(video.volume - 0.1, 0);
        break;
      case 'f':
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else video.requestFullscreen();
        break;
      case 'n':
        e.preventDefault();
        this.next();
        break;
      case 'p':
        e.preventDefault();
        this.prev();
        break;
    }
  }

  ngOnDestroy() {}
}
