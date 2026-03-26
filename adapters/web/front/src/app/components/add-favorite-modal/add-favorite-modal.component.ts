import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MALResult } from '../../types/home.types';

@Component({
  selector: 'app-add-favorite-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-favorite-modal.component.html',
})
export class AddFavoriteModalComponent {
  @Input() form = { animeName: '', animeUrl: '', malId: null as number | null };
  @Input() malResults: MALResult[] = [];
  @Input() malSearchQuery = '';

  @Output() onSubmit = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();
  @Output() onSearchMAL = new EventEmitter<void>();
  @Output() onSelectMAL = new EventEmitter<MALResult>();
  @Output() onMalQueryChange = new EventEmitter<string>();
}
