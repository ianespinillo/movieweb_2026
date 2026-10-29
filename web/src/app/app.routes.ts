import { Routes } from '@angular/router';
import { Search } from './pages/search/search';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'search',
    pathMatch: 'full',
  },
  {
    path: 'search',
    component: Search,
  },
  {
    path: 'movies/:id',
    loadComponent: () =>
      import('./pages/movie-detail/movie-detail')
        .then(m => m.MovieDetail),
  },
  {
    path: 'people/:id',
    loadComponent: () =>
      import('./pages/person-detail/person-detail')
        .then(m => m.PersonDetail),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard')
        .then(m => m.Dashboard),
  },
  {
    path: 'profile',
    redirectTo: 'dashboard',
  },
];
