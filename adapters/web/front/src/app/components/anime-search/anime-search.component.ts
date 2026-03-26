import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../types/home.types';

@Component({
  selector: 'app-anime-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './anime-search.component.html',
})
export class AnimeSearchComponent {
  @Input() searchInput = '';
  @Input() animes: { name: string; url: string }[] = [];
  @Input() isLoading = false;
  @Input() selectedAnime: { name: string; url: string } | null = null;
  @Input() currentUser: User | null = null;

  @Output() onSearchInput = new EventEmitter<Event>();
  @Output() onClear = new EventEmitter<void>();
  @Output() onSelect = new EventEmitter<{ name: string; url: string }>();
  @Output() onAddToFavorites = new EventEmitter<{ name: string; url: string }>();
}
