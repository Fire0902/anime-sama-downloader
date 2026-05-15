import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { TimeRemainingPipe } from '../pipes';

@Component({
  selector: 'app-scheduled-downloads-panel',
  standalone: true,
  imports: [CommonModule, AccordionSectionComponent, TimeRemainingPipe],
  templateUrl: './scheduled-downloads-panel.component.html',
})
export class ScheduledDownloadsPanelComponent {
  @Input() scheduledDownloads: any[] = [];
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
}