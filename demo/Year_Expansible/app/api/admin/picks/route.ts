import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { yearId, filmId, type, rank, categoryId, personId } = await request.json();

    if (!yearId || !filmId || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (type === "top10") {
      // Add to top ten picks
      if (!rank || rank < 1 || rank > 10) {
        return NextResponse.json(
          { error: "Invalid rank for top 10" },
          { status: 400 }
        );
      }

      // Update the year's top film if this is #1
      if (rank === 1) {
        await supabase
          .from("years")
          .update({ top_film_id: filmId })
          .eq("id", yearId);
      }

      const { data, error } = await supabase
        .from("top_ten_picks")
        .insert({
          year_id: yearId,
          film_id: filmId,
          rank,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating top ten pick:", error);
        return NextResponse.json(
          { error: "Failed to create pick" },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    } else if (type === "category") {
      if (!categoryId) {
        return NextResponse.json(
          { error: "Category ID required for category picks" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("category_picks")
        .insert({
          year_id: yearId,
          category_id: categoryId,
          film_id: filmId,
          person_id: personId || null,
          is_winner: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating category pick:", error);
        return NextResponse.json(
          { error: "Failed to create pick" },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: "Invalid pick type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Picks API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
