import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { User } from '../../types/home.types';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, AccordionSectionComponent],
  templateUrl: './admin-panel.component.html',
})
export class AdminPanelComponent {
  @Input() currentUser: User | null = null;
  @Input() allUsers: User[] = [];
  @Input() schedulerStatus: any = null;
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
  @Output() onRefreshScheduler = new EventEmitter<void>();
  @Output() onRestartScheduler = new EventEmitter<void>();
  @Output() onDeleteUser = new EventEmitter<number>();
  @Output() onCreateUserClick = new EventEmitter<void>();
}