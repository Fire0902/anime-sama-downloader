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

export interface Download {
  id: number;
  user_id: number | null;
  anime_name: string;
  season_name: string | null;
  episode_name: string;
  file_path: string;
  file_size: number | null;
  status: 'queued' | 'downloading' | 'encoding' | 'ready' | 'error';
  progress: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DownloadHierarchy {
  anime_name: string;
  seasons: {
    season_name: string;
    episodes: Download[];
  }[];
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

  getEpisodes(seasonUrl: string): Observable<{readerUrls: string[][]}> {
    return this.http.post<{readerUrls: string[][]}>(`${this.apiUrl}/episodes`, {
      seasonUrl
    });
  }

  deleteDownload(downloadId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/download/${downloadId}`);
  }
  getDownloads(): Observable<{ downloads: Download[] }> {
    return this.http.get<{ downloads: Download[] }>(`${this.apiUrl}/downloads`);
  }

  getDownloadHierarchy(): Observable<{ hierarchy: DownloadHierarchy[] }> {
    return this.http.get<{ hierarchy: DownloadHierarchy[] }>(`${this.apiUrl}/downloads/hierarchy`);
  }

  zipAnime(animeName: string): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/downloads/zip/anime`, 
      { animeName },
      { responseType: 'blob' }
    );
  }

  zipSeason(animeName: string, seasonName: string): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/downloads/zip/season`,
      { animeName, seasonName },
      { responseType: 'blob' }
    );
  }
}