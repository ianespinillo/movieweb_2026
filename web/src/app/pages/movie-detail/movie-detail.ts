import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-movie-detail',
  imports: [RouterLink],
  templateUrl: './movie-detail.html',
  styleUrl: './movie-detail.css',
})
export class MovieDetail {
  private route = inject(ActivatedRoute);

  movieId = this.route.snapshot.paramMap.get('id');
}