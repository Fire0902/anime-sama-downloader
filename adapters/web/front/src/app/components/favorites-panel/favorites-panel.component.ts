import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { Favorite } from '../../types/home.types';

@Component({
  selector: 'app-favorites-panel',
  standalone: true,
  imports: [CommonModule, AccordionSectionComponent],
  templateUrl: './favorites-panel.component.html',
})
export class FavoritesPanelComponent {
  @Input() favorites: Favorite[] = [];
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
  @Output() onAddClick = new EventEmitter<void>();
  @Output() onCheckFavorite = new EventEmitter<number>();
  @Output() onSearchFromFavorite = new EventEmitter<Favorite>();
  @Output() onRemoveFavorite = new EventEmitter<number>();
}