import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-create-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-user-modal.component.html',
})
export class CreateUserModalComponent {
  @Input() form = { username: '', email: '', password: '', is_admin: false };
  @Output() onSubmit = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();
}