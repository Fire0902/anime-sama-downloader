import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionSectionComponent } from '../accordion-section/accordion-section.component';
import { AnimeService } from '../../services/anime.service';
import { User } from '../../types/home.types';

export interface FTPConfig {
  id?: number;
  user_id?: number;
  protocol: 'none' | 'ftp' | 'sftp';
  host: string | null;
  port: number | null;
  username: string | null;
  remote_path: string | null;
  passive_mode: boolean;
}

@Component({
  selector: 'app-ftp-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AccordionSectionComponent],
  templateUrl: './ftp-settings-panel.component.html',
  styleUrls: ['./ftp-settings-panel.component.css']
})
export class FTPSettingsPanelComponent implements OnInit {
  @Input() currentUser: User | null = null;
  @Input() expanded = false;
  @Output() onToggle = new EventEmitter<void>();

  ftpConfig: FTPConfig = {
    protocol: 'none',
    host: null,
    port: null,
    username: null,
    remote_path: null,
    passive_mode: false
  };

  ftpPassword: string = '';  // Separate field for password input

  isLoading = false;
  isTesting = false;
  statusMessage: string = '';
  statusType: 'success' | 'error' | 'info' = 'info';

  constructor(private animeService: AnimeService) {}

  ngOnInit(): void {
    this.loadFTPConfig();
  }

  loadFTPConfig(): void {
    if (!this.currentUser) return;

    this.animeService.getFTPConfig().subscribe({
      next: (config) => {
        if (config?.config) {
          this.ftpConfig = {
            protocol: config.config.protocol || 'none',
            host: config.config.host || null,
            port: config.config.port || null,
            username: config.config.username || null,
            remote_path: config.config.remote_path || null,
            passive_mode: config.config.passive_mode || false
          };
        }
      },
      error: (error) => {
        console.error('Error loading FTP config:', error);
        this.statusMessage = 'Erreur lors du chargement de la configuration';
        this.statusType = 'error';
      }
    });
  }

  onProtocolChange(): void {
    // Set default ports based on protocol
    if (this.ftpConfig.protocol === 'ftp' && !this.ftpConfig.port) {
      this.ftpConfig.port = 21;
    } else if (this.ftpConfig.protocol === 'sftp' && !this.ftpConfig.port) {
      this.ftpConfig.port = 22;
    }
  }

  onPasswordChanged(value: string): void {
    this.ftpPassword = value;
  }

  testConnection(): void {
    // Debounce: prevent multiple simultaneous tests
    if (this.isTesting) {
      return;
    }

    // Validate before testing
    if (!this.isValidForTest()) {
      this.statusMessage = 'Veuillez remplir tous les paramètres requis (domaine, port, utilisateur).';
      this.statusType = 'error';
      this.isTesting = false;
      return;
    }

    // Validate that required fields are not null/empty
    if (!this.ftpConfig.protocol || this.ftpConfig.protocol === 'none' || !this.ftpConfig.host || !this.ftpConfig.port || !this.ftpConfig.username) {
      this.statusMessage = 'Configuration incomplète. Veuillez remplir tous les champs.';
      this.statusType = 'error';
      this.isTesting = false;
      return;
    }

    this.isTesting = true;
    this.statusMessage = 'Test de connexion en cours...';
    this.statusType = 'info';

    this.animeService.testFTPConnection({
      protocol: this.ftpConfig.protocol as 'ftp' | 'sftp',
      host: this.ftpConfig.host!,
      port: this.ftpConfig.port!,
      username: this.ftpConfig.username!,
      password: this.ftpPassword  // Use the password field
    }).subscribe({
      next: (result) => {
        this.isTesting = false;
        if (result.success) {
          this.statusMessage = '✓ Connexion réussie!';
          this.statusType = 'success';
        } else {
          this.statusMessage = '✗ Échec de la connexion. Vérifiez vos paramètres.';
          this.statusType = 'error';
        }
      },
      error: (error) => {
        this.isTesting = false;
        this.statusMessage = `Erreur lors du test: ${error?.message || 'Erreur inconnue'}`;
        this.statusType = 'error';
      }
    });
  }

  saveConfig(): void {
    if (this.ftpConfig.protocol !== 'none' && !this.isValidForSave()) {
      this.statusMessage = 'Veuillez remplir tous les champs requis.';
      this.statusType = 'error';
      return;
    }

    this.isLoading = true;
    this.statusMessage = 'Sauvegarde en cours...';
    this.statusType = 'info';

    const configToSave = {
      ...this.ftpConfig,
      password: this.ftpPassword || undefined  // Include password if provided
    };

    this.animeService.saveFTPConfig(configToSave).subscribe({
      next: (config) => {
        this.isLoading = false;
        this.ftpConfig = config;
        this.ftpPassword = '';  // Clear password field after save for security
        this.statusMessage = '✓ Configuration sauvegardée avec succès!';
        this.statusType = 'success';
        setTimeout(() => {
          this.statusMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.isLoading = false;
        this.statusMessage = `Erreur: ${error?.error?.error || error?.message || 'Erreur inconnue'}`;
        this.statusType = 'error';
      }
    });
  }

  resetConfig(): void {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser la configuration FTP?')) {
      return;
    }

    this.isLoading = true;
    this.animeService.resetFTPConfig().subscribe({
      next: () => {
        this.isLoading = false;
        this.ftpConfig = {
          protocol: 'none',
          host: null,
          port: null,
          username: null,
          remote_path: null,
          passive_mode: false
        };
        this.statusMessage = '✓ Configuration réinitialisée!';
        this.statusType = 'success';
        setTimeout(() => {
          this.statusMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.isLoading = false;
        this.statusMessage = `Erreur: ${error?.message || 'Erreur inconnue'}`;
        this.statusType = 'error';
      }
    });
  }

  private isValidForTest(): boolean {
    return this.ftpConfig.protocol !== 'none' &&
           !!this.ftpConfig.host &&
           !!this.ftpConfig.port &&
           !!this.ftpConfig.username;
  }

  private isValidForSave(): boolean {
    if (this.ftpConfig.protocol === 'none') {
      return true;
    }
    // For saving existing configs, password is optional (can keep previous)
    // But if changing protocol to ftp/sftp, all required fields plus password must be present
    return !!this.ftpConfig.host &&
           !!this.ftpConfig.port &&
           !!this.ftpConfig.username &&
           !!this.ftpConfig.remote_path &&
           !!this.ftpPassword;  // Password required on save
  }

  get testButtonDisabled(): boolean {
    return this.ftpConfig.protocol === 'none' || !this.isValidForTest() || this.isTesting;
  }

  get saveButtonDisabled(): boolean {
    return this.isLoading || (this.ftpConfig.protocol !== 'none' && !this.isValidForSave());
  }
}
