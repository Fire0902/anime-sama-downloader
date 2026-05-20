import { Component, Input, Output, EventEmitter, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AnimeService } from '../../services/anime.service';
import { User } from '../../types/home.types';

export interface JellyfinSeries {
  id: string;
  name: string;
  year?: number | null;
  posterUrl?: string | null;
  missingEpisodes: { season: number; episodes: number[] }[];
}

@Component({
  selector: 'app-jellyfin-panel',
  standalone: true,
  imports: [CommonModule, AccordionSectionComponent],
  templateUrl: './jellyfin-panel.component.html',
})
export class JellyfinPanelComponent implements OnInit, OnChanges {
  @Input() currentUser: User | null = null;
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
  @Output() onSearch = new EventEmitter<string>();

  series: JellyfinSeries[] = [];
  isLoading = false;
  error: string | null = null;

  currentPage = 0;
  readonly pageSize = 10;
  totalResults = 0;

  constructor(private animeService: AnimeService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.currentUser) this.load();
  }

  ngOnChanges(): void {
    if (this.expanded && this.currentUser && !this.series.length && !this.isLoading) {
      this.load();
    }
  }

  load(page = this.currentPage): void {
    this.isLoading = true;
    this.error = null;
    this.currentPage = page;
    this.animeService.getJellyfinAnime(page).subscribe({
      next: (data) => {
        this.series = data?.results ?? [];
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

  getMissingLabel(s: JellyfinSeries): string {
    return s.missingEpisodes
      .map(m => `S${m.season}\u202F: ép.\u202F${m.episodes.join(', ')}`)
      .join(' · ');
  }

  searchTitle(s: JellyfinSeries): void {
    this.onSearch.emit(s.name);
  }
}
