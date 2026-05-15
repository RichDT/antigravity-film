import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_CATEGORIES = [
  // Core categories
  { name: "Best Picture", slug: "best-picture", description: "Outstanding motion picture", display_order: 1 },
  { name: "Directing", slug: "directing", description: "Outstanding achievement in directing", display_order: 2 },
  { name: "Actor", slug: "actor", description: "Best performance by an actor in a leading role", display_order: 3 },
  { name: "Actress", slug: "actress", description: "Best performance by an actress in a leading role", display_order: 4 },
  { name: "Supporting Actor", slug: "supporting-actor", description: "Best performance by an actor in a supporting role", display_order: 5 },
  { name: "Supporting Actress", slug: "supporting-actress", description: "Best performance by an actress in a supporting role", display_order: 6 },
  { name: "Original Screenplay", slug: "original-screenplay", description: "Best original screenplay", display_order: 7 },
  { name: "Adapted Screenplay", slug: "adapted-screenplay", description: "Best adapted screenplay", display_order: 8 },
  
  // Technical categories
  { name: "Cinematography", slug: "cinematography", description: "Outstanding achievement in cinematography", display_order: 9 },
  { name: "Editing", slug: "editing", description: "Outstanding achievement in film editing", display_order: 10 },
  { name: "Original Score", slug: "score", description: "Best original score", display_order: 11 },
  { name: "Sound", slug: "sound", description: "Outstanding achievement in sound", display_order: 12 },
  { name: "Visual Effects", slug: "visual-effects", description: "Outstanding achievement in visual effects", display_order: 13 },
  { name: "Production Design", slug: "production-design", description: "Outstanding achievement in production design", display_order: 14 },
  
  // Extended categories
  { name: "Animated Feature", slug: "animated", description: "Best animated feature film", display_order: 15 },
  { name: "Documentary Feature", slug: "documentary", description: "Best documentary feature", display_order: 16 },
  { name: "International Feature", slug: "international", description: "Best international feature film", display_order: 17 },
  { name: "Original Song", slug: "song", description: "Best original song", display_order: 18 },
  { name: "Costume Design", slug: "costume", description: "Outstanding achievement in costume design", display_order: 19 },
  { name: "Makeup and Hairstyling", slug: "makeup", description: "Outstanding achievement in makeup and hairstyling", display_order: 20 },
];

export async function POST() {
  try {
    const supabase = await createClient();

    // Insert categories, ignoring conflicts
    for (const category of DEFAULT_CATEGORIES) {
      const { error } = await supabase
        .from("categories")
        .upsert(category, { onConflict: "slug" });
      
      if (error) {
        console.error("Error inserting category:", category.name, error);
      }
    }

    return NextResponse.json({ success: true, count: DEFAULT_CATEGORIES.length });
  } catch (error) {
    console.error("Seed categories error:", error);
    return NextResponse.json(
      { error: "Failed to seed categories" },
      { status: 500 }
    );
  }
}
