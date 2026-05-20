import { Component, Input, Output, EventEmitter, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AnimeService } from '../../services/anime.service';
import { User } from '../../types/home.types';

export interface JellyseerrRequest {
  id: number;
  status: number;
  type: 'movie' | 'tv';
  requestedBy: { displayName: string; email?: string };
  modifiedBy?: { displayName: string } | null;
  media: {
    tmdbId?: number;
    tvdbId?: number;
    mediaType: string;
    status: number;
    title?: string;
    originalTitle?: string;
    posterPath?: string | null;
  };
  seasons?: { seasonNumber: number }[];
  createdAt: string;
}

@Component({
  selector: 'app-jellyseerr-panel',
  standalone: true,
  imports: [CommonModule, AccordionSectionComponent],
  templateUrl: './jellyseerr-panel.component.html',
})
export class JellyseerrPanelComponent implements OnInit, OnChanges {
  @Input() currentUser: User | null = null;
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
  @Output() onSearch = new EventEmitter<string>();

  requests: JellyseerrRequest[] = [];
  isLoading = false;
  error: string | null = null;

  currentPage = 0;
  readonly pageSize = 5;
  totalResults = 0;

  readonly STATUS_LABELS: Record<number, string> = {
    1: 'En attente', 2: 'Approuvée', 3: 'Refusée', 4: 'Disponible', 5: 'En cours',
  };

  readonly MEDIA_STATUS_LABELS: Record<number, string> = {
    1: 'Inconnu', 2: 'En attente', 3: 'En traitement', 4: 'Disponible', 5: 'Partiel',
  };

  constructor(private animeService: AnimeService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.currentUser) this.load();
  }

  ngOnChanges(): void {
    if (this.expanded && this.currentUser && !this.requests.length && !this.isLoading) {
      this.load();
    }
  }

  load(page = this.currentPage): void {
    this.isLoading = true;
    this.error = null;
    this.currentPage = page;
    this.animeService.getJellyseerrRequests(page).subscribe({
      next: (data) => {
        this.requests = data?.results ?? [];
        this.totalResults = data?.totalResults ?? 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.error ?? 'Erreur lors du chargement';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalResults / this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 0) this.load(this.currentPage - 1);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) this.load(this.currentPage + 1);
  }

  getTitle(req: JellyseerrRequest): string {
    return req.media?.title ?? req.media?.originalTitle ?? `ID ${req.media?.tmdbId ?? req.id}`;
  }

  getPosterUrl(req: JellyseerrRequest): string | null {
    const p = req.media?.posterPath;
    if (!p) return null;
    return `https://image.tmdb.org/t/p/w300${p}`;
  }

  getAnimeSamaUrl(req: JellyseerrRequest): string {
    return `https://anime-sama.fr/catalogue/?q=${encodeURIComponent(this.getTitle(req))}`;
  }

  getMediaStatusColor(status: number): string {
    if (status === 4) return 'text-green-400';
    if (status === 3) return 'text-blue-400';
    if (status === 5) return 'text-yellow-400';
    return 'text-slate-400';
  }

  searchTitle(req: JellyseerrRequest): void {
    const title = this.getTitle(req);
    this.onSearch.emit(title);
  }
}
