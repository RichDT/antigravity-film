import type { TMDBSearchResult, TMDBMovieDetails, TMDBPersonResult } from "@/lib/types";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function getPosterUrl(path: string | null, size: "w185" | "w342" | "w500" | "original" = "w342"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path: string | null, size: "w780" | "w1280" | "original" = "w1280"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getProfileUrl(path: string | null, size: "w185" | "w342" | "original" = "w185"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export async function searchMovies(query: string, year?: number): Promise<TMDBSearchResult[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY not set");
    return [];
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
    include_adult: "false",
  });

  if (year) {
    params.append("year", year.toString());
  }

  try {
    const res = await fetch(`${TMDB_BASE_URL}/search/movie?${params}`);
    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status}`);
    }
    const data = await res.json();
    return data.results as TMDBSearchResult[];
  } catch (error) {
    console.error("TMDB search error:", error);
    return [];
  }
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovieDetails | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY not set");
    return null;
  }

  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
    );
    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("TMDB details error:", error);
    return null;
  }
}

export async function searchPeople(query: string): Promise<TMDBPersonResult[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY not set");
    return [];
  }

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
  });

  try {
    const res = await fetch(`${TMDB_BASE_URL}/search/person?${params}`);
    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status}`);
    }
    const data = await res.json();
    return data.results as TMDBPersonResult[];
  } catch (error) {
    console.error("TMDB search error:", error);
    return [];
  }
}

export function extractDirector(movie: TMDBMovieDetails): string | null {
  if (!movie.credits?.crew) return null;
  const director = movie.credits.crew.find((c) => c.job === "Director");
  return director?.name || null;
}
