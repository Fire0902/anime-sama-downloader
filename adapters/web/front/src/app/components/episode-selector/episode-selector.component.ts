import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Episode, User } from '../../types/home.types';

export interface QualityStream {
  resolution?: string;
  codecs?: string;
  bandwidth?: number;
}

export interface UrlBadge {
  label: string;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'slate';
}

@Component({
  selector: 'app-episode-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './episode-selector.component.html',
})
export class EpisodeSelectorComponent {
  @Input() episodes: Episode[] = [];
  @Input() isLoading = false;
  @Input() currentUser: User | null = null;
  @Input() qualityStreams: QualityStream[] = [];
  @Input() qualityProbing = false;
  @Input() qualityError = false;

  @Output() onToggleEpisode = new EventEmitter<Episode>();
  @Output() onToggleAll = new EventEmitter<void>();
  @Output() onValidate = new EventEmitter<void>();

  getSelectedEpisodes(): Episode[] {
    return this.episodes.filter(ep => ep.selected);
  }

  areAllEpisodesSelected(): boolean {
    return this.episodes.length > 0 && this.episodes.every(ep => ep.selected);
  }

  /** Detect source type from a URL */
  private detectSource(url: string): { label: string; color: UrlBadge['color'] } | null {
    const u = url.toLowerCase();
    if (u.includes('sibnet')) return { label: 'Sibnet', color: 'orange' };
    if (u.includes('vidmoly')) return { label: 'Vidmoly', color: 'blue' };
    if (u.includes('sendvid')) return { label: 'SendVid', color: 'purple' };
    if (u.includes('voir-anime') || u.includes('voiranime')) return { label: 'Voir-Anime', color: 'blue' };
    if (u.includes('.m3u8') || u.includes('m3u8')) return { label: 'HLS', color: 'green' };
    if (u.endsWith('.mp4') || u.includes('.mp4?')) return { label: 'MP4', color: 'green' };
    if (u.includes('anime-sama')) return { label: 'Anime-Sama', color: 'blue' };
    return null;
  }

  getUrlBadges(): UrlBadge[] {
    // If probe results available, use them (resolution + codec)
    if (this.qualityStreams.length) return this.getProbeBasedBadges();

    const firstEp = this.episodes[0];
    if (!firstEp) return [];

    const urls = firstEp.urls?.length ? firstEp.urls : [firstEp.readerUrl];
    const badges: UrlBadge[] = [];
    const seenLabels = new Set<string>();

    for (const url of urls) {
      if (!url) continue;
      const source = this.detectSource(url);
      if (source && !seenLabels.has(source.label)) {
        seenLabels.add(source.label);
        badges.push(source);
      }
    }

    // Resolution from URL if detectable (direct streams)
    const allUrls = urls.join(' ').toLowerCase();
    const resMatch = allUrls.match(/[/_\-](\d{3,4})p[/_\-. ?]/);
    if (resMatch) badges.push({ label: resMatch[1] + 'p', color: 'blue' });

    // Show source count if multiple
    if (urls.filter(u => u).length > 1) {
      badges.push({ label: `${urls.filter(u => u).length} sources`, color: 'slate' });
    }

    return badges;
  }

  private getProbeBasedBadges(): UrlBadge[] {
    const badges: UrlBadge[] = [];
    const seen = new Set<string>();
    for (const s of this.qualityStreams) {
      const res = this.formatResolution(s.resolution);
      if (res && !seen.has(res)) { seen.add(res); badges.push({ label: res, color: 'blue' }); }
    }
    const best = this.qualityStreams.reduce((b, s) => (s.bandwidth || 0) > (b.bandwidth || 0) ? s : b);
    const codec = this.formatCodec(best.codecs);
    if (codec) badges.push({ label: codec, color: 'purple' });
    return badges;
  }

  private formatResolution(resolution?: string): string {
    if (!resolution) return '';
    const match = resolution.match(/\d+x(\d+)/);
    if (!match) return resolution;
    const h = parseInt(match[1]);
    if (h >= 2160) return '4K';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    return `${h}p`;
  }

  private formatCodec(codecs?: string): string {
    if (!codecs) return '';
    const c = codecs.toLowerCase();
    if (c.includes('hvc1') || c.includes('hev1') || c.includes('hevc')) return 'H.265';
    if (c.includes('avc1') || c.includes('avc')) return 'H.264';
    if (c.includes('vp9')) return 'VP9';
    if (c.includes('av01') || c.includes('av1')) return 'AV1';
    return codecs.split(',')[0];
  }

  badgeClass(color: UrlBadge['color']): string {
    const map: Record<UrlBadge['color'], string> = {
      blue:   'bg-blue-600/30 border-blue-500/50 text-blue-300',
      purple: 'bg-purple-600/30 border-purple-500/50 text-purple-300',
      green:  'bg-emerald-600/30 border-emerald-500/50 text-emerald-300',
      orange: 'bg-orange-600/30 border-orange-500/50 text-orange-300',
      slate:  'bg-slate-700/50 border-slate-500/50 text-slate-400',
    };
    return 'text-xs font-bold border px-2 py-0.5 rounded-md ' + map[color];
  }
}
