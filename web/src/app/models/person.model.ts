export interface Person {
  id: number;
  name: string;
}

export interface PeopleSearchResponse {
  actors: Person[];
  directors: Person[];
}