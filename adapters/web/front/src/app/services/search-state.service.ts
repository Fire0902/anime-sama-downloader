import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SearchStateService {
  pendingSearch: string | null = null;
}
