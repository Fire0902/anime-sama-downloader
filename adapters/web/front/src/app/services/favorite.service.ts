import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Favorite {
  id: number;
  user_id: number;
  anime_name: string;
  anime_url: string;
  mal_id: number | null;
  is_ongoing: boolean;
  last_episode_downloaded: number;
  last_checked: string | null;
  created_at: string;
}

export interface MALSearchResult {
  id: number;
  title: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getFavorites(): Observable<{ favorites: Favorite[] }> {
    return this.http.get<{ favorites: Favorite[] }>(`${this.apiUrl}/favorites`);
  }

  addFavorite(animeName: string, animeUrl: string, malId?: number): Observable<{ favorite: Favorite }> {
    return this.http.post<{ favorite: Favorite }>(`${this.apiUrl}/favorites`, {
      animeName,
      animeUrl,
      malId
    });
  }

  removeFavorite(favoriteId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/favorites/${favoriteId}`);
  }

  searchMAL(query: string): Observable<{ results: MALSearchResult[] }> {
    return this.http.get<{ results: MALSearchResult[] }>(`${this.apiUrl}/mal/search`, {
      params: { q: query }
    });
  }
}