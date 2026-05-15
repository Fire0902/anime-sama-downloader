import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';

const STORAGE_KEY = 'maxConcurrentDownloads';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AccordionSectionComponent],
  templateUrl: './settings-panel.component.html',
})
export class SettingsPanelComponent implements OnInit {
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();
  @Output() onMaxConcurrentChange = new EventEmitter<number>();

  maxConcurrent = 3;

  ngOnInit(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.maxConcurrent = saved ? parseInt(saved, 10) : 3;
  }

  onChange(): void {
    localStorage.setItem(STORAGE_KEY, String(this.maxConcurrent));
    this.onMaxConcurrentChange.emit(this.maxConcurrent);
  }
}
