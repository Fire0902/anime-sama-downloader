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

export interface Episode {
  url: string;
}

export interface SearchResponse {
  animesTitle: AnimeTitles;
}

export interface SeasonsResponse {
  animeSeasons: Season[];
}

export interface ExistingDownload {
  downloadId: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  createdAt: Date;
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

  getEpisodes(seasonUrl: string): Observable<{m3u8url: Array<Array<string>>}> {
    return this.http.post<{m3u8url: Array<Array<string>>}>(`${this.apiUrl}/episodes`, {
      seasonUrl
    });
  }

  getExistingDownloads(): Observable<{ downloads: ExistingDownload[] }> {
    return this.http.get<{ downloads: ExistingDownload[] }>(`${this.apiUrl}/existing-downloads`);
  }

  deleteDownload(downloadId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/download/${downloadId}`);
  }
}