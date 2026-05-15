import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Download } from '../../types/home.types';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-video-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-modal.component.html',
})
export class VideoModalComponent {
  @Input() episode: Download | null = null;

  @Output() onClose = new EventEmitter<void>();

  readonly apiUrl = environment.apiUrl;
}
