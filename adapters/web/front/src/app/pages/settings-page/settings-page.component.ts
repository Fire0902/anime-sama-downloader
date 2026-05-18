import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../types/home.types';
import { ChangeDetectorRef } from '@angular/core';
import { FTPSettingsPanelComponent } from '../../components/ftp-settings-panel/ftp-settings-panel.component';
import { FolderStructurePanelComponent } from '../../components/folder-structure-panel/folder-structure-panel.component';
import { StoragePanelComponent } from '../../components/storage-panel/storage-panel.component';
import { SettingsPanelComponent } from '../../components/settings-panel/settings-panel.component';
import { DownloadStateService } from '../../services/download-state.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    FTPSettingsPanelComponent,
    FolderStructurePanelComponent,
    StoragePanelComponent,
    SettingsPanelComponent,
  ],
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  expanded: Record<string, boolean> = {
    ftp: false, folderStructure: false, storage: false, settings: false,
  };
  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private downloadState: DownloadStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub.add(this.authService.currentUser$.subscribe(u => { this.currentUser = u; this.cdr.detectChanges(); }));
  }

  toggle(key: string) { this.expanded[key] = !this.expanded[key]; }

  onMaxConcurrentChange(value: number) { this.downloadState.onMaxConcurrentChange(value); }

  ngOnDestroy() { this.sub.unsubscribe(); }
}
