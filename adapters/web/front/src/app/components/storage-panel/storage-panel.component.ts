import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AnimeService } from '../../services/anime.service';

export interface StorageInfo {
  downloadPath: string;
  downloadPathSize: number;
  diskTotal: number;
  diskFree: number;
  diskUsed: number;
  percentUsed: number;
  percentDownloadOfDisk: number;
  downloadPathSizeFormatted: string;
  diskTotalFormatted: string;
  diskFreeFormatted: string;
  diskUsedFormatted: string;
}

@Component({
  selector: 'app-storage-panel',
  standalone: true,
  imports: [CommonModule, AccordionSectionComponent],
  templateUrl: './storage-panel.component.html',
  styleUrls: ['./storage-panel.component.css']
})
export class StoragePanelComponent implements OnInit {
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();

  storageInfo: StorageInfo | null = null;
  isLoading = false;

  constructor(private animeService: AnimeService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadStorageInfo();
    // Refresh storage info every 30 seconds
    setInterval(() => this.loadStorageInfo(), 30000);
  }

  loadStorageInfo(): void {
    this.isLoading = true;
    this.animeService.getStorageInfo().subscribe({
      next: (response: { storage: StorageInfo }) => {
        this.storageInfo = response.storage;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading storage info:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Calculate position in slider (0-100) for download folder percentage of disk
   */
  getDownloadSliderPosition(): number {
    if (!this.storageInfo) return 0;
    return Math.min(100, Math.max(0, this.storageInfo.percentDownloadOfDisk));
  }

  /**
   * Calculate position in slider (0-100) for used disk percentage
   */
  getUsedSliderPosition(): number {
    if (!this.storageInfo) return 0;
    return Math.min(100, Math.max(0, this.storageInfo.percentUsed));
  }
}
