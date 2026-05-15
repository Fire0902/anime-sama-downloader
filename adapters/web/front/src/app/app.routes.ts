import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

// Guard pour protéger les routes authentifiées
export const authGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        return true;
    }

    console.log('Non authentifié, redirection vers /login');
    router.navigate(['/login']);
    return false;
};

export const loginGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
        return true;
    }

    console.log('Déjà authentifié, redirection vers /');
    router.navigate(['/']);
    return false;
};

// Guard pour les routes admin
export const adminGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = authService.getCurrentUser();

    if (user && user.is_admin) {
        return true;
    }

    console.log('Accès admin refusé');
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
        loadComponent: () =>
            import('./components/home/home.component').then(m => m.HomeComponent),
        canActivate: [authGuard]
    },
    {
        path: 'admin',
        loadComponent: () => import('./components/admin/admin.component').then(m => m.AdminComponent),
        canActivate: [authGuard, adminGuard]
    },
    {
        path: '**',
        redirectTo: ''
    }
];