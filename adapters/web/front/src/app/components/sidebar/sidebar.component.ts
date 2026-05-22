import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { User } from '../../types/home.types';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnChanges {
  @Input() collapsed = false;
  @Input() isAdmin = false;
  @Input() user: User | null = null;
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() openCreateUser = new EventEmitter<void>();

  gravatarUrl: string | null = null;
  avatarError = false;

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['user'] && this.user?.email) {
      this.avatarError = false;
      const hash = await sha256Hex(this.user.email);
      this.gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=80&d=404`;
    } else if (!this.user?.email) {
      this.gravatarUrl = null;
    }
  }

  onAvatarError() {
    this.avatarError = true;
  }

  get showGravatar(): boolean {
    return !this.avatarError && !!this.gravatarUrl;
  }

  get userInitial(): string {
    return this.user?.username?.charAt(0)?.toUpperCase() || '?';
  }
}
