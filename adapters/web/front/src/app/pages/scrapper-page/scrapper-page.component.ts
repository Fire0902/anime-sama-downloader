import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { AnimeService } from '../../services/anime.service';
import { ChangeDetectorRef } from '@angular/core';

export type StartFrom = 'catalogue' | 'seasons' | 'episodes';

@Component({
  selector: 'app-scrapper-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scrapper-page.component.html',
})
export class ScrapperPageComponent implements OnInit, OnDestroy {
  scrapperStatus: any = { status: 'idle', progress: { step: '', current: 0, total: 0 } };
  resolveM3u8 = false;
  startFrom: StartFrom = 'catalogue';
  stats: Record<string, { animes: number; seasons: number; episodes: number }> = {};
  dbAvailable = false;

  private pollSub: Subscription | null = null;
  private sub = new Subscription();

  readonly providers = [
    { id: 'anime-sama', label: 'Anime-Sama' },
    { id: 'voir-anime', label: 'Voir-Anime' },
    { id: 'voir-drama', label: 'Voir-Drama' },
    { id: 'all', label: 'Tout scrapper' },
  ];

  readonly startFromOptions: { value: StartFrom; label: string; description: string }[] = [
    { value: 'catalogue', label: 'Catalogue complet', description: 'Repart de zéro : catalogue → saisons → épisodes' },
    { value: 'seasons', label: 'Reprendre depuis les saisons', description: 'Utilise les animes déjà en BD, scrape les saisons + épisodes manquants' },
    { value: 'episodes', label: 'Reprendre depuis les épisodes', description: 'Utilise les saisons déjà en BD, scrape uniquement les épisodes manquants' },
  ];

  statsLoading = false;

  constructor(
    private animeService: AnimeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadStatus();
    this.loadStats();
  }

  private loadStatus() {
    this.animeService.getScrapperStatus().subscribe({
      next: s => {
        this.scrapperStatus = s;
        if (s.status === 'running') this.startPoll();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private loadStats() {
    this.statsLoading = true;
    this.animeService.getScrapperStats().subscribe({
      next: r => {
        this.stats = r.stats || {};
        this.dbAvailable = Object.values(this.stats).some(s => s.animes > 0);
        this.statsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.statsLoading = false; this.cdr.detectChanges(); }
    });
  }

  refresh() {
    this.loadStatus();
    this.loadStats();
  }

  startScrapper(provider: string) {
    this.animeService.startScrapper(provider, this.resolveM3u8, this.startFrom).subscribe({
      next: () => { this.startPoll(); this.cdr.detectChanges(); },
      error: err => { alert('Erreur: ' + (err.error?.error || err.message)); }
    });
  }

  stopScrapper() {
    this.animeService.stopScrapper().subscribe({
      next: () => { this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  downloadDb() {
    this.animeService.downloadLocalDb().subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'anime.db';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: err => { alert('Erreur: ' + (err.error?.error || err.message)); }
    });
  }

  private startPoll() {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(2000).pipe(
      takeWhile(() => this.scrapperStatus?.status === 'running', true)
    ).subscribe(() => {
      this.animeService.getScrapperStatus().subscribe({
        next: s => {
          this.scrapperStatus = s;
          if (s.status !== 'running') {
            this.loadStats();
            this.pollSub?.unsubscribe();
          }
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    });
  }

  get progressPct(): number {
    const { current, total } = this.scrapperStatus?.progress ?? {};
    return total > 0 ? Math.round((current / total) * 100) : 0;
  }

  totalAnimes(): number {
    return Object.values(this.stats).reduce((s, p) => s + p.animes, 0);
  }

  totalSeasons(): number {
    return Object.values(this.stats).reduce((s, p) => s + p.seasons, 0);
  }

  totalEpisodes(): number {
    return Object.values(this.stats).reduce((s, p) => s + p.episodes, 0);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.pollSub?.unsubscribe();
  }
}
