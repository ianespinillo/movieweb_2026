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
];