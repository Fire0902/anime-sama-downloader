import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-accordion-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accordion-section.component.html',
})
export class AccordionSectionComponent {
  @Input() title = '';
  @Input() badge: string | number | null = null;
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
}