import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Season } from '../../services/anime.service';

@Component({
  selector: 'app-season-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './season-selector.component.html',
})
export class SeasonSelectorComponent {
  @Input() seasons: Season[] = [];
  @Input() isLoading = false;

  @Output() onSelect = new EventEmitter<Season>();
}
