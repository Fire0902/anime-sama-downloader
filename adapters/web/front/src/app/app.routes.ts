import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ShellComponent } from './components/shell/shell.component';
import { SearchPageComponent } from './pages/search-page/search-page.component';
import { DownloadsPageComponent } from './pages/downloads-page/downloads-page.component';
import { FavoritesPageComponent } from './pages/favorites-page/favorites-page.component';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { AdminPageComponent } from './pages/admin-page/admin-page.component';

export const authGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    if (authService.isAuthenticated()) return true;
    router.navigate(['/login']);
    return false;
};

export const loginGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    if (!authService.isAuthenticated()) return true;
    router.navigate(['/']);
    return false;
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
        path: 'login',
        loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
        canActivate: [loginGuard]
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
            { path: 'admin', component: AdminPageComponent, canActivate: [adminGuard] },
        ]
    },
    { path: '**', redirectTo: '' }
];
