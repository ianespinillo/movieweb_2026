import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';

import type { Keyword } from '@movieweb/contracts';
import { Movie as MovieService } from '../../services/movie';
import { PersonService } from '../../services/person';
import { AuthService } from '../../services/auth';
import { SearchState } from '../../services/search-state';
import { AuthModal } from '../auth-modal/auth-modal';

export interface AutocompleteSuggestion {
  id: string | number;
  title: string;
  subtitle: string;
  type: 'movie' | 'person' | 'keyword';
  typeLabel: string;
  icon: string;
  route?: (string | number)[];
  keyword?: string;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, AuthModal],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  private readonly router = inject(Router);
  private readonly movieService = inject(MovieService);
  private readonly personService = inject(PersonService);
  readonly authService = inject(AuthService);
  private readonly searchState = inject(SearchState);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authService.currentUser;
  readonly searchQuery = signal('');

  // Autocomplete
  private readonly autocompleteSubject = new Subject<string>();
  readonly autocompleteSuggestions = signal<AutocompleteSuggestion[]>([]);
  readonly isAutocompleteLoading = signal(false);
  readonly showAutocomplete = signal(false);
  readonly activeSuggestionIndex = signal(-1);
  readonly isInputFocused = signal(false);

  constructor() {
    this.initAutocomplete();
    this.syncQueryWithRoute();
  }

  private syncQueryWithRoute(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const urlTree = this.router.parseUrl(this.router.url);
        const q = urlTree.queryParams['q'];
        if (q !== undefined) {
          this.searchQuery.set(q);
        } else if (urlTree.root.children['primary']?.segments[0]?.path === 'search') {
          this.searchQuery.set('');
        }
      });
  }

  private initAutocomplete(): void {
    this.autocompleteSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(term => {
        const trimmed = term.trim();
        if (!trimmed || trimmed.length < 2) {
          return of<AutocompleteSuggestion[]>([]);
        }

        this.isAutocompleteLoading.set(true);

        return forkJoin({
          movies: this.movieService.searchMovies(trimmed, 1, 5).pipe(
            map(res => res.items),
            catchError(() => of([]))
          ),
          people: this.personService.searchPeople(trimmed, 1, 3).pipe(
            map(res => res.items),
            catchError(() => of([]))
          ),
          keywords: this.movieService.suggestKeywords(trimmed, 3).pipe(
            catchError(() => of([] as Keyword[]))
          ),
        }).pipe(
          map(({ movies, people, keywords }) => {
            const list: AutocompleteSuggestion[] = [];

            // 1. Películas
            for (const m of movies) {
              const year = m.release_date ? m.release_date.slice(0, 4) : '';
              list.push({
                id: `m_${m.movie_id}`,
                title: m.title,
                subtitle: year ? `${year} • Película` : 'Película',
                type: 'movie',
                typeLabel: 'Película',
                icon: '🎬',
                route: ['/movies', m.movie_id],
              });
            }

            // 2. Personas (actores / directores)
            for (const p of people) {
              const role = p.is_director && p.is_actor
                ? 'Director / Actor'
                : p.is_director
                ? 'Director'
                : 'Actor';
              list.push({
                id: `p_${p.person_id}`,
                title: p.person_name,
                subtitle: role,
                type: 'person',
                typeLabel: role,
                icon: '👤',
                route: ['/people', p.person_id],
              });
            }

            // 3. Palabras clave
            for (const k of keywords) {
              list.push({
                id: `k_${k.keyword_id}`,
                title: k.keyword_name,
                subtitle: 'Palabra clave',
                type: 'keyword',
                typeLabel: 'Keyword',
                icon: '🏷️',
                keyword: k.keyword_name,
              });
            }

            // Máximo 5 sugerencias
            return list.slice(0, 5);
          }),
          finalize(() => this.isAutocompleteLoading.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(suggestions => {
      this.autocompleteSuggestions.set(suggestions);
      this.showAutocomplete.set(suggestions.length > 0 && this.isInputFocused());
      this.activeSuggestionIndex.set(-1);
    });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.autocompleteSubject.next(value);
  }

  onInputFocus(): void {
    this.isInputFocused.set(true);
    if (this.autocompleteSuggestions().length > 0) {
      this.showAutocomplete.set(true);
    }
  }

  onInputBlur(): void {
    setTimeout(() => {
      this.isInputFocused.set(false);
      this.showAutocomplete.set(false);
    }, 220);
  }

  onKeydown(event: KeyboardEvent): void {
    const suggestions = this.autocompleteSuggestions();
    const isDropdownVisible = this.showAutocomplete() && suggestions.length > 0;

    if (event.key === 'ArrowDown') {
      if (!isDropdownVisible) return;
      event.preventDefault();
      const nextIndex = (this.activeSuggestionIndex() + 1) % suggestions.length;
      this.activeSuggestionIndex.set(nextIndex);
    } else if (event.key === 'ArrowUp') {
      if (!isDropdownVisible) return;
      event.preventDefault();
      const prevIndex = (this.activeSuggestionIndex() - 1 + suggestions.length) % suggestions.length;
      this.activeSuggestionIndex.set(prevIndex);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const activeIdx = this.activeSuggestionIndex();
      if (isDropdownVisible && activeIdx >= 0 && activeIdx < suggestions.length) {
        this.selectSuggestion(suggestions[activeIdx]);
      } else {
        this.search();
      }
    } else if (event.key === 'Escape') {
      this.showAutocomplete.set(false);
      this.activeSuggestionIndex.set(-1);
    }
  }

  selectSuggestion(item: AutocompleteSuggestion, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.showAutocomplete.set(false);

    if (item.type === 'movie' || item.type === 'person') {
      if (item.route) {
        this.router.navigate(item.route);
      }
    } else if (item.type === 'keyword') {
      const kw = item.keyword || item.title;
      this.searchKeyword(kw);
    }
  }

  searchKeyword(keyword: string): void {
    this.searchQuery.set(keyword);
    this.showAutocomplete.set(false);
    this.search();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.autocompleteSuggestions.set([]);
    this.showAutocomplete.set(false);
    this.activeSuggestionIndex.set(-1);
  }

  search(): void {
    const query = this.searchQuery().trim();
    this.showAutocomplete.set(false);

    if (!query) return;

    this.searchState.clear();

    this.router.navigate(['/search'], {
      queryParams: { q: query },
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
