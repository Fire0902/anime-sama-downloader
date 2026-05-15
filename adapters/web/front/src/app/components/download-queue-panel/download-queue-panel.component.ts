import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DownloadNode } from '../../types/home.types';

@Component({
  selector: 'app-download-queue-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download-queue-panel.component.html',
})
export class DownloadQueuePanelComponent {
  @Input() queue: DownloadNode[] = [];
  @Input() expanded = false;

  @Output() onToggle = new EventEmitter<void>();
  @Output() onRemove = new EventEmitter<DownloadNode>();
}
