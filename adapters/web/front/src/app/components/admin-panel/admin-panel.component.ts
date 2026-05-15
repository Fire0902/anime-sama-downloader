import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AnimeService } from '../../services/anime.service';
import { User } from '../../types/home.types';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AccordionSectionComponent],
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

  editingPasswordFor: number | null = null;
  newPassword: string = '';
  pwSaving = false;
  pwSuccess: number | null = null;
  pwError: string | null = null;

  constructor(private animeService: AnimeService) {}

  togglePasswordEdit(userId: number): void {
    this.editingPasswordFor = this.editingPasswordFor === userId ? null : userId;
    this.newPassword = '';
    this.pwError = null;
    this.pwSuccess = null;
  }

  savePassword(userId: number): void {
    this.pwError = null;
    this.pwSaving = true;
    this.animeService.updateUserPassword(userId, this.newPassword).subscribe({
      next: () => {
        this.pwSaving = false;
        this.pwSuccess = userId;
        this.newPassword = '';
        this.editingPasswordFor = null;
        setTimeout(() => (this.pwSuccess = null), 3000);
      },
      error: (err) => {
        this.pwSaving = false;
        this.pwError = err?.error?.error ?? 'Erreur';
      },
    });
  }
}
