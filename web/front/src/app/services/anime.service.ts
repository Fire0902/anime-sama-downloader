import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AnimeTitles {
  [key: string]: string;
}

export interface Season {
  name: string;
  link: string;
}

export interface SearchResponse {
  animesTitle: AnimeTitles;
}

export interface SeasonsResponse {
  animeSeasons: Season[];
}

@Injectable({
  providedIn: 'root'
})
export class AnimeService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  searchAnimes(value: string): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.apiUrl}/input`, {
      value,
    });
  }

  getSeasons(animeUrl: string): Observable<SeasonsResponse> {
    return this.http.post<SeasonsResponse>(`${this.apiUrl}/seasons`, {
      animeUrl
    });
  }
}