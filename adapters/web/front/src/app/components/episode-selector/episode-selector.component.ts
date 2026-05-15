import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Episode, User } from '../../types/home.types';

@Component({
  selector: 'app-episode-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './episode-selector.component.html',
})
export class EpisodeSelectorComponent {
  @Input() episodes: Episode[] = [];
  @Input() isLoading = false;
  @Input() currentUser: User | null = null;

  @Output() onToggleEpisode = new EventEmitter<Episode>();
  @Output() onToggleAll = new EventEmitter<void>();
  @Output() onValidate = new EventEmitter<void>();

  getSelectedEpisodes(): Episode[] {
    return this.episodes.filter(ep => ep.selected);
  }

  areAllEpisodesSelected(): boolean {
    return this.episodes.length > 0 && this.episodes.every(ep => ep.selected);
  }
}
