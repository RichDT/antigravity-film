import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMovieDetails, getPosterUrl, getBackdropUrl, extractDirector } from "@/lib/tmdb";

export async function POST(request: NextRequest) {
  try {
    const { tmdbId } = await request.json();

    if (!tmdbId || typeof tmdbId !== "number") {
      return NextResponse.json(
        { error: "Invalid TMDB ID" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if film already exists
    const { data: existing } = await supabase
      .from("films")
      .select("*")
      .eq("tmdb_id", tmdbId)
      .single();

    if (existing) {
      return NextResponse.json(existing);
    }

    // Fetch details from TMDB
    const movieDetails = await getMovieDetails(tmdbId);
    if (!movieDetails) {
      return NextResponse.json(
        { error: "Failed to fetch movie details from TMDB" },
        { status: 500 }
      );
    }

    const releaseYear = movieDetails.release_date
      ? parseInt(movieDetails.release_date.split("-")[0], 10)
      : null;

    // Create the film
    const { data: film, error } = await supabase
      .from("films")
      .insert({
        title: movieDetails.title,
        year: releaseYear,
        tmdb_id: tmdbId,
        poster_url: getPosterUrl(movieDetails.poster_path),
        backdrop_url: getBackdropUrl(movieDetails.backdrop_path),
        director: extractDirector(movieDetails),
        synopsis: movieDetails.overview,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating film:", error);
      return NextResponse.json(
        { error: "Failed to create film" },
        { status: 500 }
      );
    }

    return NextResponse.json(film);
  } catch (error) {
    console.error("Films API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
