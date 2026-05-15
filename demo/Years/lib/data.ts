import { createClient } from "@/lib/supabase/server";
import type { 
  YearWithTopFilm, 
  YearWithDetails, 
  Category,
  CategoryPick,
  Film,
  Person 
} from "@/lib/types";

export async function getYearsWithTopFilms(): Promise<YearWithTopFilm[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("years")
    .select(`
      *,
      top_film:films!years_top_film_id_fkey(*)
    `)
    .order("year", { ascending: false });
  
  if (error) {
    console.error("Error fetching years:", error);
    return [];
  }
  
  return data as YearWithTopFilm[];
}

export async function getYearWithDetails(year: number): Promise<YearWithDetails | null> {
  const supabase = await createClient();
  
  // Get the year record
  const { data: yearData, error: yearError } = await supabase
    .from("years")
    .select(`
      *,
      top_film:films!years_top_film_id_fkey(*)
    `)
    .eq("year", year)
    .single();
  
  if (yearError || !yearData) {
    console.error("Error fetching year:", yearError);
    return null;
  }
  
  // Get top ten picks
  const { data: topTen, error: topTenError } = await supabase
    .from("top_ten_picks")
    .select(`
      *,
      film:films(*)
    `)
    .eq("year_id", yearData.id)
    .order("rank", { ascending: true });
  
  if (topTenError) {
    console.error("Error fetching top ten:", topTenError);
  }
  
  // Get category picks
  const { data: categoryPicks, error: categoryError } = await supabase
    .from("category_picks")
    .select(`
      *,
      category:categories(*),
      film:films(*),
      person:people(*)
    `)
    .eq("year_id", yearData.id)
    .order("category_id", { ascending: true });
  
  if (categoryError) {
    console.error("Error fetching category picks:", categoryError);
  }
  
  return {
    ...yearData,
    top_ten: topTen || [],
    category_picks: categoryPicks || [],
  } as YearWithDetails;
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });
  
  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
  
  return data as Category[];
}

export async function getCategoryWithPicks(slug: string): Promise<{
  category: Category | null;
  picks: (CategoryPick & { year: { year: number }; film?: Film; person?: Person })[];
}> {
  const supabase = await createClient();
  
  // Get category
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();
  
  if (categoryError || !category) {
    console.error("Error fetching category:", categoryError);
    return { category: null, picks: [] };
  }
  
  // Get all picks for this category
  const { data: picks, error: picksError } = await supabase
    .from("category_picks")
    .select(`
      *,
      year:years(year),
      film:films(*),
      person:people(*)
    `)
    .eq("category_id", category.id)
    .eq("is_winner", true)
    .order("year_id", { ascending: false });
  
  if (picksError) {
    console.error("Error fetching picks:", picksError);
    return { category, picks: [] };
  }
  
  return { category, picks: picks || [] };
}

export async function searchFilmsAndPeople(query: string): Promise<{
  films: Film[];
  people: Person[];
}> {
  if (!query || query.length < 2) {
    return { films: [], people: [] };
  }
  
  const supabase = await createClient();
  const searchTerm = `%${query}%`;
  
  // Search films
  const { data: films, error: filmsError } = await supabase
    .from("films")
    .select("*")
    .ilike("title", searchTerm)
    .limit(20);
  
  if (filmsError) {
    console.error("Error searching films:", filmsError);
  }
  
  // Search people
  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("*")
    .ilike("name", searchTerm)
    .limit(20);
  
  if (peopleError) {
    console.error("Error searching people:", peopleError);
  }
  
  return {
    films: films || [],
    people: people || [],
  };
}

export async function getFilmAppearances(filmId: string): Promise<{
  topTenPicks: (import("@/lib/types").TopTenPick & { year: { year: number } })[];
  categoryPicks: (CategoryPick & { category: Category; year: { year: number } })[];
}> {
  const supabase = await createClient();
  
  const { data: topTenPicks, error: topTenError } = await supabase
    .from("top_ten_picks")
    .select(`
      *,
      year:years(year)
    `)
    .eq("film_id", filmId)
    .order("rank", { ascending: true });
  
  if (topTenError) {
    console.error("Error fetching top ten picks:", topTenError);
  }
  
  const { data: categoryPicks, error: categoryError } = await supabase
    .from("category_picks")
    .select(`
      *,
      category:categories(*),
      year:years(year)
    `)
    .eq("film_id", filmId);
  
  if (categoryError) {
    console.error("Error fetching category picks:", categoryError);
  }
  
  return {
    topTenPicks: topTenPicks || [],
    categoryPicks: categoryPicks || [],
  };
}

export async function getPersonAppearances(personId: string): Promise<{
  categoryPicks: (CategoryPick & { category: Category; year: { year: number }; film?: Film })[];
}> {
  const supabase = await createClient();
  
  const { data: categoryPicks, error } = await supabase
    .from("category_picks")
    .select(`
      *,
      category:categories(*),
      year:years(year),
      film:films(*)
    `)
    .eq("person_id", personId);
  
  if (error) {
    console.error("Error fetching person appearances:", error);
  }
  
  return {
    categoryPicks: categoryPicks || [],
  };
}
