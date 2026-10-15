import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-person-detail',
  imports: [RouterLink],
  templateUrl: './person-detail.html',
  styleUrl: './person-detail.css',
})
export class PersonDetail {
  private route = inject(ActivatedRoute);

  personId = this.route.snapshot.paramMap.get('id');
}