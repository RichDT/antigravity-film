export interface Film {
  id: string;
  title: string;
  year: number;
  poster_url: string | null;
  backdrop_url: string | null;
  director: string | null;
  synopsis: string | null;
  created_at: string;
  updated_at: string;
}

export interface Year {
  id: string;
  year: number;
  top_film_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  top_film?: Film | null;
}

export interface TopTenPick {
  id: string;
  year_id: string;
  film_id: string;
  rank: number;
  notes: string | null;
  created_at: string;
  film?: Film;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
  photo_url: string | null;
  created_at: string;
}

export interface CategoryPick {
  id: string;
  year_id: string;
  category_id: string;
  film_id: string | null;
  person_id: string | null;
  is_winner: boolean;
  notes: string | null;
  created_at: string;
  film?: Film;
  person?: Person;
  category?: Category;
  year?: Year;
}

export interface YearWithTopFilm extends Year {
  top_film: Film | null;
}

export interface YearWithDetails extends Year {
  top_ten: (TopTenPick & { film: Film })[];
  category_picks: (CategoryPick & { category: Category; film?: Film; person?: Person })[];
}

