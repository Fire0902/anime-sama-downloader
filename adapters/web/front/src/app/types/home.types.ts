import { Subscription } from 'rxjs';

export interface DownloadNode {
  id: string;
  downloaderName?: string;
  name: string;
  animeName?: string;
  seasonName?: string;
  fileName: string;
  m3u8Url: string;
  urls?: string[];
  directDownload?: boolean;
  seasonIndex?: number;
  episodeIndex?: number;
  downloadState: 'queued' | 'downloading' | 'encoding' | 'ready' | 'error';
  ftpStatus?: 'idle' | 'uploading' | 'completed' | 'failed';
  ftpProgress?: number;
  ftpTotal?: number;
  progress: number;
  estimatedDuration: number;
  progressPercent: number;
  fileSize: number;
  downloadUrl: string;
  downloadSubscription: Subscription | null;
  errorMessage?: string;
}

export interface Episode {
  readerUrl: string;
  urls?: string[];
  name: string;
  selected: boolean;
  episodeIndex: number;
  seasonIndex?: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

export interface Favorite {
  id: number;
  user_id: number;
  anime_name: string;
  anime_url: string;
  mal_id?: number;
  is_ongoing: boolean;
  last_episode_downloaded: number;
  next_episode_time: string;
  next_episode_at?: string;
}

export interface Download {
  id: string;
  anime_name: string;
  season_name?: string;
  episode_name: string;
  file_path: string;
  file_size: number;
  status: string;
  progress: number;
  user_id: number;
}

export interface DownloadHierarchy {
  anime_name: string;
  totalEpisodes: number;
  seasons: {
    season_name: string;
    episodes: Download[];
  }[];
}

export interface MALResult {
  id: number;
  title: string;
}