import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AnimeService, Season, type Provider } from '../../services/anime.service';
import { AuthService } from '../../services/auth.service';
import { DownloadStateService } from '../../services/download-state.service';
import { SearchStateService } from '../../services/search-state.service';
import { AnimeSearchComponent } from '../../components/anime-search/anime-search.component';
import { SeasonSelectorComponent } from '../../components/season-selector/season-selector.component';
import { EpisodeSelectorComponent } from '../../components/episode-selector/episode-selector.component';
import { DownloadQueuePanelComponent } from '../../components/download-queue-panel/download-queue-panel.component';
import { AccordionSectionComponent } from '../../components/accordion-section/accordion-section.component';
import { AddFavoriteModalComponent } from '../../components/add-favorite-modal/add-favorite-modal.component';
import { JellyseerrPanelComponent } from '../../components/jellyseerr-panel/jellyseerr-panel.component';
import { Episode, User, DownloadNode, MALResult } from '../../types/home.types';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AnimeSearchComponent,
    SeasonSelectorComponent,
    EpisodeSelectorComponent,
    DownloadQueuePanelComponent,
    AccordionSectionComponent,
    AddFavoriteModalComponent,
    JellyseerrPanelComponent,
  ],
  templateUrl: './search-page.component.html',
})
export class SearchPageComponent implements OnInit, OnDestroy {
  private apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;
  currentUser: User | null = null;
  selectedProvider: Provider = 'anime-sama';
  searchInput = '';
  animes: { name: string; url: string }[] = [];
  seasons: Season[] = [];
  selectedAnime: { name: string; url: string } | null = null;
  selectedSeason: Season = { name: '', link: '' };
  isLoadingAnimes = false;
  isLoadingSeasons = false;
  isLoadingEpisodes = false;
  episodes: Episode[] = [];
  queuedDownloads: DownloadNode[] = [];

  // Add Favorite modal
  showAddFavoriteModal = false;
  addFavoriteForm = { animeName: '', animeUrl: '', malId: null as number | null };
  malSearchQuery = '';
  malResults: MALResult[] = [];

  // M3U8
  m3u8Url = '';
  m3u8AnimeName = '';
  m3u8SeasonName = 'Saison 1';
  m3u8EpisodeName = '';
  m3u8GuessIndex = true;
  m3u8ManualIndex = 1;
  m3u8UploadedFileName = '';
  m3u8IsUploading = false;

  expandedQueue = false;
  expandedErrors = false;
  expandedM3U8 = false;
  expandedJellyseerr = false;

  private searchSubject = new Subject<string>();
  private sub = new Subscription();

  constructor(
    private animeService: AnimeService,
    private authService: AuthService,
    private downloadState: DownloadStateService,
    private searchStateService: SearchStateService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub.add(this.authService.currentUser$.subscribe(u => { this.currentUser = u; this.cdr.detectChanges(); }));
    this.sub.add(
      this.downloadState.downloadQueue$.subscribe(queue => {
        this.queuedDownloads = queue.filter(d => d.downloadState === 'queued');
        this.cdr.detectChanges();
      })
    );
    this.initSearchSubscription();

    const pending = this.searchStateService.pendingSearch;
    if (pending) {
      this.searchStateService.pendingSearch = null;
      this.searchInput = pending;
      this.searchSubject.next(pending);
    }
  }

  private initSearchSubscription() {
    const sub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        if (!value.trim()) {
          this.animes = [];
          this.seasons = [];
          this.cdr.detectChanges();
          return of(null);
        }
        this.isLoadingAnimes = true;
        this.cdr.detectChanges();
        return this.animeService.searchAnimes(value, this.selectedProvider);
      })
    ).subscribe({
      next: response => {
        this.isLoadingAnimes = false;
        this.animes = response?.animesTitle
          ? Object.entries(response.animesTitle).map(([name, url]) => ({ name, url: url as string }))
          : [];
        this.seasons = [];
        this.cdr.detectChanges();
      },
      error: () => { this.isLoadingAnimes = false; this.animes = []; this.cdr.detectChanges(); }
    });
    this.sub.add(sub);
  }

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput = value;
    this.searchSubject.next(value);
  }

  selectAnime(anime: { name: string; url: string }) {
    this.selectedAnime = anime;
    this.searchInput = anime.name;
    this.animes = [];
    this.isLoadingSeasons = true;
    this.episodes = [];
    this.animeService.getSeasons(anime.url, this.selectedProvider).subscribe({
      next: response => {
        this.isLoadingSeasons = false;
        if (response?.animeSeasons) {
          this.seasons = response.animeSeasons.map((s: Season) => ({ ...s, link: `${anime.url}${s.link}` }));
        }
        this.cdr.detectChanges();
      },
      error: () => { this.isLoadingSeasons = false; this.cdr.detectChanges(); }
    });
  }

  selectSeason(season: Season) {
    if (!this.selectedAnime) return;
    this.selectedSeason = season;
    this.isLoadingEpisodes = true;
    const seasonIndex = this.seasons.findIndex(s => s.name === season.name);
    this.animeService.getEpisodes(season.link, this.selectedProvider).subscribe({
      next: response => {
        if (response?.readerUrls && response.readerUrls.length > 0) {
          const maxEpisodes = response.readerUrls[0]?.length || 0;
          const episodeNames = response.episodeNames || [];
          this.episodes = [];
          for (let i = 0; i < maxEpisodes; i++) {
            const urls = response.readerUrls.map((src: string[]) => src[i]).filter((u: string) => u && u.trim());
            if (urls.length > 0) {
              const name = episodeNames[i] || `Episode-${i + 1}.mp4`;
              const rawFileName = name.endsWith('.mp4') ? name : `${name}.mp4`;
              const fileName = rawFileName.replace(/^Episode (\d)/i, 'Episode-$1');
              this.episodes.push({ readerUrl: urls[0], urls, name: fileName, selected: false, episodeIndex: i, seasonIndex });
            }
          }
        } else {
          alert('Erreur: URLs des épisodes introuvables');
        }
        this.isLoadingEpisodes = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoadingEpisodes = false; alert('Erreur lors de la récupération des épisodes'); this.cdr.detectChanges(); }
    });
  }

  clearSearch() {
    this.searchInput = '';
    this.animes = [];
    this.seasons = [];
    this.selectedAnime = null;
    this.episodes = [];
  }

  onProviderChange(provider: Provider) {
    this.selectedProvider = provider;
    this.clearSearch();
  }

  toggleEpisode(episode: Episode) { episode.selected = !episode.selected; }

  toggleAllEpisodes() {
    const allSelected = this.episodes.every(ep => ep.selected);
    this.episodes.forEach(ep => ep.selected = !allSelected);
  }

  validateDownloads() {
    if (!this.currentUser) { alert('Veuillez vous connecter pour télécharger'); return; }
    const selected = this.episodes.filter(ep => ep.selected);
    if (!selected.length) { alert('Veuillez sélectionner au moins un épisode'); return; }
    selected.forEach(ep => this.downloadState.addToDownloadQueue(
      ep.readerUrl, ep.name, ep.name,
      this.selectedAnime?.name || '', this.selectedSeason?.name || '',
      ep.urls, ep.episodeIndex, ep.seasonIndex
    ));
    this.episodes.forEach(ep => ep.selected = false);
  }

  addToFavorites(anime: { name: string; url: string }) {
    if (!this.currentUser) { alert('Veuillez vous connecter pour ajouter des favoris'); return; }
    this.addFavoriteForm.animeName = anime.name;
    this.addFavoriteForm.animeUrl = anime.url;
    this.showAddFavoriteModal = true;
  }

  async addFavorite() {
    try {
      await this.http.post(`${this.apiUrl}/favorites`, this.addFavoriteForm).toPromise();
      this.showAddFavoriteModal = false;
      this.addFavoriteForm = { animeName: '', animeUrl: '', malId: null };
      this.malResults = [];
    } catch (error: any) { alert(error.error?.error || "Erreur lors de l'ajout"); }
  }

  async searchMAL() {
    if (!this.malSearchQuery.trim()) return;
    try {
      const response: any = await this.http.get(`${this.apiUrl}/mal/search?q=${encodeURIComponent(this.malSearchQuery)}`).toPromise();
      this.malResults = response.results;
      this.cdr.detectChanges();
    } catch {}
  }

  selectMALResult(result: MALResult) {
    this.addFavoriteForm.malId = result.id;
    this.malResults = [];
    this.malSearchQuery = result.title;
  }

  get errorsCount(): number {
    return this.downloadState.getErroredDownloads().length;
  }

  get erroredDownloads(): DownloadNode[] {
    return this.downloadState.getErroredDownloads();
  }

  removeDownload(node: DownloadNode) { this.downloadState.removeDownload(node); }
  retryDownload(node: DownloadNode) { this.downloadState.retryDownload(node); }
  clearErrors() { this.downloadState.clearErroredDownloads(); }
  downloadErrorLog() { this.downloadState.downloadErrorLog(); }

  onJellyseerrSearch(title: string) {
    this.searchInput = title;
    this.searchSubject.next(title);
  }

  // M3U8
  guessEpisodeIndex(name: string): number {
    const numbers = name.match(/\d+/g);
    if (!numbers || !numbers.length) return 0;
    return parseInt(numbers[numbers.length - 1], 10);
  }

  onM3U8FileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.m3u8IsUploading = true;
    this.m3u8UploadedFileName = file.name;
    this.cdr.detectChanges();
    const reader = new FileReader();
    reader.onload = () => {
      this.animeService.uploadM3U8File(reader.result as string).subscribe({
        next: res => {
          this.m3u8Url = res.filePath;
          this.m3u8IsUploading = false;
          if (!this.m3u8EpisodeName) this.m3u8EpisodeName = file.name.replace(/\.m3u8$/i, '');
          this.cdr.detectChanges();
        },
        error: err => {
          alert('Erreur upload m3u8: ' + (err.error?.error || err.message));
          this.m3u8IsUploading = false;
          this.m3u8UploadedFileName = '';
          input.value = '';
          this.cdr.detectChanges();
        }
      });
    };
    reader.readAsText(file);
  }

  downloadFromM3U8() {
    if (!this.currentUser) { alert('Veuillez vous connecter pour télécharger'); return; }
    const url = this.m3u8Url.trim();
    const animeName = this.m3u8AnimeName.trim();
    const episodeName = this.m3u8EpisodeName.trim();
    if (!url || !animeName || !episodeName) { alert("URL m3u8, nom d'anime et nom d'épisode sont requis"); return; }
    const episodeIndex = this.m3u8GuessIndex ? this.guessEpisodeIndex(episodeName) : this.m3u8ManualIndex;
    const fileName = episodeName.endsWith('.mp4') ? episodeName : `${episodeName}.mp4`;
    const seasonName = this.m3u8SeasonName.trim() || 'Saison 1';
    this.downloadState.addToDownloadQueue(url, fileName, fileName, animeName, seasonName, [url], episodeIndex, 0);
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}
