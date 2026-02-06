import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AnimeService, AnimeTitles, Season } from './services/anime.service';
import { ChangeDetectorRef } from '@angular/core';
import { SocketService } from './services/socket.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule
    ],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})

export class AppComponent implements OnDestroy {
    searchInput = '';
    animes: { name: string; url: string }[] = [];
    seasons: Season[] = [];
    selectedAnime: { name: string; url: string } | null = null;
    isLoadingAnimes = false;
    isLoadingSeasons = false;

    private searchSubject = new Subject<string>();
    private subscription = new Subscription();
    progress = -1;
    downloadSubscription: Subscription = new Subscription();


    constructor(
        private animeService: AnimeService,
        private cdr: ChangeDetectorRef,
        private router: Router,
        private socketService: SocketService
    ) {
        this.initSearchSubscription();
    }

    downloadEpisode(m3u8Url: string, fileName: string) {
        this.socketService.downloadEpisode(m3u8Url, fileName);

        this.downloadSubscription.add(
            this.socketService.onProgress().subscribe(data => {
                this.progress = data.current;
            })
        );

        this.downloadSubscription.add(
            this.socketService.onDone().subscribe(({ fileName, data }) => {
                const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(link.href);
                this.progress = -1;
            })
        );

        this.downloadSubscription.add(
            this.socketService.onError().subscribe(err => {
                console.error('Erreur téléchargement:', err.message);
                this.progress = -1;
            })
        );
    }

    private initSearchSubscription(): void {
        const searchSub = this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(value => {
                if (!value.trim()) {
                    this.animes = [];
                    this.seasons = [];
                    return of(null);
                }

                this.isLoadingAnimes = true;
                return this.animeService.searchAnimes(value);
            })

        ).subscribe({
            next: (response) => {
                this.isLoadingAnimes = false;
                if (response && response.animesTitle) {
                    this.animes = Object.entries(response.animesTitle).map(([name, url]) => ({
                        name,
                        url
                    }));
                } else {
                    this.animes = [];
                }
                this.cdr.detectChanges();
                this.seasons = [];
            },
            error: (error) => {
                console.error('Erreur de recherche:', error);
                this.isLoadingAnimes = false;
                this.cdr.detectChanges();
                this.animes = [];
            }
        });

        this.subscription.add(searchSub);
    }

    onSearchInput(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.searchInput = value;
        this.searchSubject.next(value);
    }

    selectAnime(anime: { name: string; url: string }): void {
        this.selectedAnime = anime;
        this.searchInput = anime.name;
        this.animes = [];
        this.isLoadingSeasons = true;

        this.animeService.getSeasons(anime.url).subscribe({
            next: (response) => {
                this.isLoadingSeasons = false;
                if (response && response.animeSeasons) {
                    this.seasons = response.animeSeasons.map(season => ({
                        ...season,
                        link: `${anime.url}${season.link}`
                    }));
                }
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Erreur lors du chargement des saisons:', error);
                this.isLoadingSeasons = false;
                this.cdr.detectChanges();
            }
        });
    }

    selectSeason(season: Season): void {
        if (!this.selectedAnime) return;

        const fileName = `${this.selectedAnime.name}-${season.name}.mp4`;
        const m3u8Url = season.link;

        this.downloadEpisode(m3u8Url, fileName);
    }

    clearSearch(): void {
        this.searchInput = '';
        this.animes = [];
        this.seasons = [];
        this.selectedAnime = null;
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.downloadSubscription.unsubscribe();
    }
}