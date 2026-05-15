import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-zip-progress-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-slate-600">
        <div class="flex flex-col items-center gap-4">
          <!-- Spinner -->
          <div class="relative w-16 h-16">
            <div class="absolute inset-0 border-4 border-slate-600 rounded-full"></div>
            <div class="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin"></div>
          </div>

          <!-- Title -->
          <h3 class="text-lg font-semibold text-white">Création du ZIP</h3>

          <!-- Status -->
          <p class="text-sm text-slate-300 text-center">
            Compression en cours...
          </p>

          <!-- Info -->
          <p class="text-xs text-slate-400 text-center">
            Cela peut prendre quelques minutes selon la taille des fichiers.
          </p>

          <!-- Progress bar - indeterminate -->
          <div class="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ZipProgressModalComponent {
  @Input() isOpen = false;
  @Output() onClose = new EventEmitter<void>();
}
