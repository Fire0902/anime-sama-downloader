import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ShellComponent } from './components/shell/shell.component';
import { SearchPageComponent } from './pages/search-page/search-page.component';
import { DownloadsPageComponent } from './pages/downloads-page/downloads-page.component';
import { FavoritesPageComponent } from './pages/favorites-page/favorites-page.component';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { AdminPageComponent } from './pages/admin-page/admin-page.component';
import { ScrapperPageComponent } from './pages/scrapper-page/scrapper-page.component';
import { SetupPageComponent } from './pages/setup-page/setup-page.component';
import { environment } from '../environments/environment';

async function hasUsers(): Promise<boolean> {
    const apiUrl = localStorage.getItem('apiUrl') || environment.apiUrl;
    const http = inject(HttpClient);
    try {
        const res = await firstValueFrom(http.get<{ hasUsers: boolean }>(`${apiUrl}/auth/has-users`));
        return res.hasUsers;
    } catch {
        return true; // on error, assume users exist (safe default)
    }
}

export const authGuard = async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // First-run check: redirect to setup if no users exist
    const usersExist = await hasUsers();
    if (!usersExist) {
        router.navigate(['/setup']);
        return false;
    }

    if (authService.isAuthenticated()) return true;
    router.navigate(['/login']);
    return false;
};

export const loginGuard = async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // If no users yet, go to setup
    const usersExist = await hasUsers();
    if (!usersExist) {
        router.navigate(['/setup']);
        return false;
    }

    if (!authService.isAuthenticated()) return true;
    router.navigate(['/']);
    return false;
};

export const setupGuard = async () => {
    const router = inject(Router);
    const usersExist = await hasUsers();
    if (usersExist) {
        router.navigate(['/login']);
        return false;
    }
    return true;
};

export const adminGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const user = authService.getCurrentUser();
    if (user && user.is_admin) return true;
    router.navigate(['/']);
    return false;
};

export const routes: Routes = [
    {
        path: 'setup',
        component: SetupPageComponent,
        canActivate: [setupGuard],
    },
    {
        path: 'login',
        loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
        canActivate: [loginGuard],
    },
    {
        path: '',
        component: ShellComponent,
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'search', pathMatch: 'full' },
            { path: 'search', component: SearchPageComponent },
            { path: 'downloads', component: DownloadsPageComponent },
            { path: 'favorites', component: FavoritesPageComponent },
            { path: 'settings', component: SettingsPageComponent },
            { path: 'scrapper', component: ScrapperPageComponent },
            { path: 'admin', component: AdminPageComponent, canActivate: [adminGuard] },
        ]
    },
    { path: '**', redirectTo: '' }
];
