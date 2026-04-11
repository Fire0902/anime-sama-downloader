import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AnimeService } from '../../services/anime.service';
import { User } from '../../types/home.types';

export interface FolderStructureConfig {
  mode: 'mode1' | 'mode2' | 'mode3';
  season_format?: string;
  episode_format?: string;
  add_season_index?: boolean;
  season_index_space?: boolean;
  add_episode_index?: boolean;
  episode_index_space?: boolean;
}

@Component({
  selector: 'app-folder-structure-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AccordionSectionComponent],
  templateUrl: './folder-structure-panel.component.html',
  styleUrls: ['./folder-structure-panel.component.css']
})
export class FolderStructurePanelComponent implements OnInit {
  @Input() currentUser: User | null = null;
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();

  config: FolderStructureConfig = {
    mode: 'mode1',
    season_format: 'season_name',
    episode_format: 'episode_name',
    add_season_index: false,
    season_index_space: true,
    add_episode_index: false,
    episode_index_space: true
  };

  isLoading = false;
  statusMessage: string = '';
  statusType: 'success' | 'error' | 'info' = 'info';

  // Preview
  previewAnime = 'One Piece';
  previewSeasonName = 'Wano Arc';
  previewSeasonIndex = 5;
  previewEpisodeName = 'Episode 1050';
  previewEpisodeIndex = 1050;

  constructor(private animeService: AnimeService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    if (!this.currentUser) return;

    this.animeService.getFolderStructureConfig().subscribe({
      next: (response: any) => {
        if (response?.config) {
          this.config = {
            mode: response.config.mode || 'mode1',
            season_format: response.config.season_format || 'season_name',
            episode_format: response.config.episode_format || 'episode_name',
            add_season_index: response.config.add_season_index || false,
            season_index_space: response.config.season_index_space !== false,
            add_episode_index: response.config.add_episode_index || false,
            episode_index_space: response.config.episode_index_space !== false
          };
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error loading folder structure config:', error);
      }
    });
  }

  saveConfig(): void {
    this.isLoading = true;
    this.statusMessage = 'Sauvegarde en cours...';
    this.statusType = 'info';

    this.animeService.saveFolderStructureConfig(this.config).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.statusMessage = '✓ Configuration sauvegardée avec succès!';
        this.statusType = 'success';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.statusMessage = '';
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (error) => {
        this.isLoading = false;
        this.statusMessage = `Erreur: ${error?.error?.error || error?.message || 'Erreur inconnue'}`;
        this.statusType = 'error';
        this.cdr.detectChanges();
      }
    });
  }

  getPreview(): string {
    return this.buildPath(
      this.previewAnime,
      this.previewSeasonName,
      this.previewSeasonIndex,
      this.previewEpisodeName,
      this.previewEpisodeIndex
    );
  }

  private buildPath(
    anime: string,
    seasonName: string,
    seasonIndex: number,
    episode: string,
    episodeIndex: number
  ): string {
    const parts: string[] = [anime];

    let seasonFolder = '';
    if (this.config.mode === 'mode1') {
      seasonFolder = seasonName;
    } else if (this.config.mode === 'mode2') {
      seasonFolder = `Season ${seasonIndex}`;
    } else if (this.config.mode === 'mode3') {
      seasonFolder = this.config.season_format || 'season_name';
      seasonFolder = seasonFolder.replace('{name}', seasonName);
      seasonFolder = seasonFolder.replace('{index}', String(seasonIndex));

      if (this.config.add_season_index) {
        const spacing = this.config.season_index_space ? ' ' : '';
        seasonFolder += `${spacing}${seasonIndex}`;
      }
    }

    if (seasonFolder) {
      parts.push(seasonFolder);
    }

    let episodeFile = episode;
    if (this.config.mode === 'mode3' && this.config.episode_format) {
      episodeFile = this.config.episode_format;
      episodeFile = episodeFile.replace('{name}', episode);
      episodeFile = episodeFile.replace('{index}', String(episodeIndex));

      if (this.config.add_episode_index) {
        const spacing = this.config.episode_index_space ? ' ' : '';
        episodeFile += `${spacing}${episodeIndex}`;
      }
    }

    return parts.join('/') + '/' + episodeFile + '.mp4';
  }

  get saveDisabled(): boolean {
    return this.isLoading;
  }
}
