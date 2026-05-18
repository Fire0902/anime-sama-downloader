import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SearchStateService } from '../../services/search-state.service';
import { Router } from '@angular/router';
import { FavoritesPanelComponent } from '../../components/favorites-panel/favorites-panel.component';
import { ScheduledDownloadsPanelComponent } from '../../components/scheduled-downloads-panel/scheduled-downloads-panel.component';
import { AddFavoriteModalComponent } from '../../components/add-favorite-modal/add-favorite-modal.component';
import { HttpClient } from '@angular/common/http';
import { Favorite, MALResult, User } from '../../types/home.types';
import { ChangeDetectorRef } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CommonModule, FavoritesPanelComponent, ScheduledDownloadsPanelComponent, AddFavoriteModalComponent],
  templateUrl: './favorites-page.component.html',
})
export class FavoritesPageComponent implements OnInit, OnDestroy {
  private apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;
  currentUser: User | null = null;
  favorites: Favorite[] = [];
  scheduledDownloads: any[] = [];
  showAddFavoriteModal = false;
  addFavoriteForm = { animeName: '', animeUrl: '', malId: null as number | null };
  malSearchQuery = '';
  malResults: MALResult[] = [];
  favoritesExpanded = true;
  scheduledExpanded = true;

  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private searchState: SearchStateService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub.add(this.authService.currentUser$.subscribe(u => {
      this.currentUser = u;
      if (u) {
        this.loadFavorites();
        this.loadScheduledDownloads();
      }
    }));
  }

  async loadFavorites() {
    try {
      const response: any = await this.http.get(`${this.apiUrl}/favorites`).toPromise();
      this.favorites = response.favorites;
      this.cdr.detectChanges();
    } catch {}
  }

  async loadScheduledDownloads() {
    try {
      const response: any = await this.http.get(`${this.apiUrl}/favorites/scheduled`).toPromise();
      this.scheduledDownloads = response.scheduled || [];
      this.cdr.detectChanges();
    } catch { this.scheduledDownloads = []; }
  }

  async checkFavoriteNow(favoriteId: number) {
    try {
      const response: any = await this.http.post(`${this.apiUrl}/favorites/${favoriteId}/check-now`, {}).toPromise();
      const fav = response.favorite;
      let message = `${fav.anime_name}\n\nStatut MAL: ${fav.mal_status}\nÉpisodes sur MAL: ${fav.num_episodes}\nDerniers téléchargés: ${fav.last_downloaded}\n`;
      message += fav.new_episodes_available > 0 ? `\n${fav.new_episodes_available} nouveau(x) épisode(s) disponible(s) !` : '\nAucun nouvel épisode';
      if (fav.next_episode_broadcast) message += `\n\nProchaine diffusion: ${fav.next_episode_broadcast.day} à ${fav.next_episode_broadcast.time} JST`;
      alert(message);
      this.loadFavorites();
    } catch (error: any) { alert('Erreur: ' + (error.error?.error || error.message)); }
  }

  async removeFavorite(favoriteId: number) {
    if (!confirm('Retirer cet anime de vos favoris ?')) return;
    try {
      await this.http.delete(`${this.apiUrl}/favorites/${favoriteId}`).toPromise();
      this.loadFavorites();
    } catch {}
  }

  searchAnimeFromFavorite(favorite: Favorite) {
    this.searchState.pendingSearch = favorite.anime_name;
    this.router.navigate(['/search']);
  }

  async addFavorite() {
    try {
      await this.http.post(`${this.apiUrl}/favorites`, this.addFavoriteForm).toPromise();
      this.showAddFavoriteModal = false;
      this.addFavoriteForm = { animeName: '', animeUrl: '', malId: null };
      this.malResults = [];
      this.loadFavorites();
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

  ngOnDestroy() { this.sub.unsubscribe(); }
}
