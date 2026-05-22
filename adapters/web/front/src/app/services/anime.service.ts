import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export type Provider = 'anime-sama' | 'voir-anime' | 'voir-drama';

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
  private apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;

  constructor(private http: HttpClient) {}

  searchAnimes(value: string, provider: Provider = 'anime-sama'): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.apiUrl}/input`, {
      value,
      provider,
    });
  }

  getSeasons(animeUrl: string, provider: Provider = 'anime-sama'): Observable<SeasonsResponse> {
    return this.http.post<SeasonsResponse>(`${this.apiUrl}/seasons`, {
      animeUrl,
      provider,
    });
  }

  getEpisodes(seasonUrl: string, provider: Provider = 'anime-sama'): Observable<{readerUrls: string[][], episodeNames?: string[]}> {
    return this.http.post<{readerUrls: string[][], episodeNames?: string[]}>(`${this.apiUrl}/episodes`, {
      seasonUrl,
      provider,
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

  getDownloadPath(): Observable<{ downloadPath: string }> {
    return this.http.get<{ downloadPath: string }>(`${this.apiUrl}/settings/download-path`);
  }

  setDownloadPath(downloadPath: string): Observable<{ downloadPath: string }> {
    return this.http.post<{ downloadPath: string }>(`${this.apiUrl}/settings/download-path`, {
      downloadPath,
    });
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

  uploadM3U8File(content: string): Observable<{ filePath: string }> {
    return this.http.post<{ filePath: string }>(`${this.apiUrl}/m3u8/upload`, { content });
  }

  // FTP Configuration Methods
  getFTPConfig(): Observable<any> {
    return this.http.get<{ config: any }>(`${this.apiUrl}/settings/ftp`);
  }

  saveFTPConfig(config: any): Observable<any> {
    return this.http.post<{ config: any }>(`${this.apiUrl}/settings/ftp`, config);
  }

  testFTPConnection(testData: any): Observable<any> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/settings/ftp/test`, testData);
  }

  resetFTPConfig(): Observable<any> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/settings/ftp`);
  }

  // Folder Structure Configuration Methods
  getFolderStructureConfig(): Observable<any> {
    return this.http.get<{ config: any }>(`${this.apiUrl}/settings/folder-structure`);
  }

  saveFolderStructureConfig(config: any): Observable<any> {
    return this.http.post<{ config: any }>(`${this.apiUrl}/settings/folder-structure`, config);
  }

  // Storage Information Methods
  getStorageInfo(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/settings/storage`);
  }

  getJellyseerrConfig(): Observable<{ url: string; hasToken: boolean }> {
    return this.http.get<{ url: string; hasToken: boolean }>(`${this.apiUrl}/settings/jellyseerr`);
  }

  saveJellyseerrConfig(url: string, token: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/settings/jellyseerr`, { url, token });
  }

  getJellyseerrRequests(page: number = 0): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/jellyseerr/requests?page=${page}`);
  }

  getJellyfinConfig(): Observable<{ url: string; hasToken: boolean; libraryId: string }> {
    return this.http.get<{ url: string; hasToken: boolean; libraryId: string }>(`${this.apiUrl}/settings/jellyfin`);
  }

  saveJellyfinConfig(url: string, token: string, libraryId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/settings/jellyfin`, { url, token, libraryId });
  }

  getPerfConfig(): Observable<{ lowRamMode: boolean }> {
    return this.http.get<{ lowRamMode: boolean }>(`${this.apiUrl}/settings/perf`);
  }

  savePerfConfig(lowRamMode: boolean): Observable<{ success: boolean; lowRamMode: boolean }> {
    return this.http.post<{ success: boolean; lowRamMode: boolean }>(`${this.apiUrl}/settings/perf`, { lowRamMode });
  }

  getJellyfinLibraries(): Observable<{ libraries: { id: string; name: string }[] }> {
    return this.http.get<{ libraries: { id: string; name: string }[] }>(`${this.apiUrl}/jellyfin/libraries`);
  }

  getJellyfinAnime(page: number = 0): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/jellyfin/anime?page=${page}`);
  }

  updateUserPassword(userId: number, password: string): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(`${this.apiUrl}/admin/users/${userId}/password`, { password });
  }

  // ─── Scrapper ───────────────────────────────────────────────────────────────

  startScrapper(provider: string, resolveM3u8: boolean = false, startFrom: string = 'catalogue'): Observable<{ started: boolean; provider: string }> {
    return this.http.post<{ started: boolean; provider: string }>(`${this.apiUrl}/scrapper/start`, { provider, resolveM3u8, startFrom });
  }

  getScrapperStatus(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/scrapper/status`);
  }

  stopScrapper(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/scrapper/stop`, {});
  }

  downloadLocalDb(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/scrapper/db/download`, { responseType: 'blob' });
  }

  getLocalDbAvailable(): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>(`${this.apiUrl}/db/available`);
  }

  getScrapperStats(): Observable<{ stats: Record<string, { animes: number; seasons: number; episodes: number }> }> {
    return this.http.get<{ stats: Record<string, { animes: number; seasons: number; episodes: number }> }>(`${this.apiUrl}/scrapper/stats`);
  }

  // ─── Local DB search ────────────────────────────────────────────────────────

  searchLocalDb(value: string, provider?: string): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.apiUrl}/db/input`, { value, provider });
  }

  getLocalDbSeasons(animeUrl: string): Observable<SeasonsResponse> {
    return this.http.post<SeasonsResponse>(`${this.apiUrl}/db/seasons`, { animeUrl });
  }

  getLocalDbEpisodes(seasonUrl: string): Observable<{ readerUrls: string[][]; episodeNames?: string[] }> {
    return this.http.post<{ readerUrls: string[][]; episodeNames?: string[] }>(`${this.apiUrl}/db/episodes`, { seasonUrl });
  }
}