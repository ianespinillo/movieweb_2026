import { Component, signal } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-search',
  styleUrl: './search.css',
  templateUrl: './search.html',
})
export class Search {
  searchQuery = signal('');
  submittedQuery = signal('');
  movies = [];
  actors = [
    { id: 1, name: 'Leonardo DiCaprio' },
    { id: 2, name: 'Kate Winslet' }
  ];

  directors = [
    { id: 3, name: 'James Cameron' },
    { id: 4, name: 'Christopher Nolan' }
  ];

  search() {
    if (this.searchQuery().trim() !== '') {
      this.submittedQuery.set(this.searchQuery().trim());
      console.log('Buscando:', this.searchQuery().trim());
    }
  }
}