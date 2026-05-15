import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { FileSizePipe, FormatTimePipe } from '../pipes';
import { DownloadNode } from '../../types/home.types';

@Component({
  selector: 'app-active-downloads-panel',
  standalone: true,
  imports: [CommonModule, AccordionSectionComponent, FormatTimePipe, FileSizePipe],
  templateUrl: './active-downloads-panel.component.html',
})
export class ActiveDownloadsPanelComponent {
  @Input() downloads: DownloadNode[] = [];
  @Input() maxConcurrent = 3;
  @Input() expanded = true;
  @Output() onToggle = new EventEmitter<void>();
  @Output() onRemove = new EventEmitter<DownloadNode>();

  isDownloadSizeBased(dl: DownloadNode): boolean {
    return dl.downloaderName === 'Sibnet' || dl.estimatedDuration > 1024 * 1024;
  }
}