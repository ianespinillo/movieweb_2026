
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';

import {
    ActivatedRoute,
    Router,
    RouterLink
} from '@angular/router';

import {
    takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
    catchError,
    from,
    map,
    mergeMap,
    of,
    switchMap,
    tap
} from 'rxjs';

import type {
    KeywordMovie
} from '@movieweb/contracts';

import {
    KeywordService
} from '../../services/keyword';

import {
    Movie as MovieService
} from '../../services/movie';

@Component({
    selector: 'app-keyword-search',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './keyword-search.html',
    styleUrl: './keyword-search.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordSearch {
    private readonly keywords = inject(KeywordService);
    private readonly movies = inject(MovieService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    readonly query = signal('');
    readonly submittedQuery = signal('');
    readonly searched = signal(false);
    readonly loading = signal(false);
    readonly loadingMore = signal(false);
    readonly error = signal(false);
    readonly moreError = signal(false);

    readonly results = signal<KeywordMovie[]>([]);
    readonly page = signal(0);
    readonly totalPages = signal(0);
    readonly total = signal(0);

    readonly posters = signal<Record<number, string | null>>({});

    private requestVersion = 0;

    constructor() {
        this.route.queryParamMap.pipe(
            map(params => params.get('q')?.trim() ?? ''),

            tap(q => {
                this.requestVersion++;

                this.query.set(q);
                this.submittedQuery.set(q);
                this.searched.set(Boolean(q));
                this.loading.set(Boolean(q));

                this.loadingMore.set(false);
                this.error.set(false);
                this.moreError.set(false);

                this.results.set([]);
                this.page.set(0);
                this.totalPages.set(0);
                this.total.set(0);
                this.posters.set({});
            }),

            switchMap(q => q
                ? this.keywords.search(q).pipe(
                    map(data => ({
                        data,
                        failed: false
                    })),

                    catchError(err => {
                        console.error('Error buscando keywords:', err);
                        return of({
                            data: null,
                            failed: true
                        });
                    })
                )
                : of({
                    data: null,
                    failed: false
                })
            ),

            takeUntilDestroyed(this.destroyRef)

        ).subscribe(({ data, failed }) => {
            this.loading.set(false);
            this.error.set(failed);

            if (!data) return;

            this.results.set(data.items);
            this.page.set(data.page);
            this.totalPages.set(data.totalPages);
            this.total.set(data.total);

            this.loadPosters(data.items);
        });
    }

    search(): void {
        const q = this.query().trim();

        if (!q) return;

        if (q === this.submittedQuery()) {
            this.reload(q);
            return;
        }

        this.router.navigate(['/keywords'], {
            queryParams: { q }
        });
    }

    private reload(q: string): void {
        const version = ++this.requestVersion;

        this.loading.set(true);
        this.error.set(false);
        this.moreError.set(false);
        this.loadingMore.set(false);

        this.results.set([]);
        this.page.set(0);
        this.totalPages.set(0);
        this.total.set(0);
        this.posters.set({});
        this.searched.set(true);

        this.keywords.search(q)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: data => {
                    if (version !== this.requestVersion) return;

                    this.results.set(data.items);
                    this.page.set(data.page);
                    this.totalPages.set(data.totalPages);
                    this.total.set(data.total);

                    this.loading.set(false);
                    this.loadPosters(data.items);
                },

                error: err => {
                    if (version !== this.requestVersion) return;

                    console.error('Error buscando keywords:', err);
                    this.error.set(true);
                    this.loading.set(false);
                }
            });
    }

    hasMore(): boolean {
        return this.page() > 0 &&
            this.page() < this.totalPages();
    }

    loadMore(): void {
        if (
            this.loading() ||
            this.loadingMore() ||
            !this.hasMore()
        ) return;

        const version = this.requestVersion;

        this.loadingMore.set(true);
        this.moreError.set(false);

        this.keywords.search(
            this.submittedQuery(),
            this.page() + 1
        )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: data => {
                    if (version !== this.requestVersion) return;

                    this.results.update(items => [
                        ...items,
                        ...data.items
                    ]);

                    this.page.set(data.page);
                    this.totalPages.set(data.totalPages);
                    this.total.set(data.total);

                    this.loadingMore.set(false);
                    this.loadPosters(data.items);
                },

                error: err => {
                    if (version !== this.requestVersion) return;

                    console.error('Error cargando más keywords:', err);
                    this.moreError.set(true);
                    this.loadingMore.set(false);
                }
            });
    }

    private loadPosters(items: KeywordMovie[]): void {
        const version = this.requestVersion;

        const unseen = items.filter(
            movie => !(movie.movie_id in this.posters())
        );

        from(unseen).pipe(
            mergeMap(
                movie => this.movies.getTmdbMovie(movie.movie_id).pipe(
                    map(meta => ({
                        id: movie.movie_id,
                        path: meta.poster_path
                    })),

                    catchError(() =>
                        of({
                            id: movie.movie_id,
                            path: null
                        })
                    )
                ),
                3
            ),

            takeUntilDestroyed(this.destroyRef)

        ).subscribe(({ id, path }) => {
            if (version !== this.requestVersion) return;

            this.posters.update(current => ({
                ...current,
                [id]: path
                    ? `https://image.tmdb.org/t/p/w342${path}`
                    : null
            }));
        });
    }
}
