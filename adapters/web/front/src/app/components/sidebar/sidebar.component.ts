import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { User } from '../../types/home.types';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() isAdmin = false;
  @Input() user: User | null = null;
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() openCreateUser = new EventEmitter<void>();
}
