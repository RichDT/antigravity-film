import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { year } = await request.json();

    if (!year || typeof year !== "number" || year < 1900 || year > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { error: "Invalid year" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if year already exists
    const { data: existing } = await supabase
      .from("years")
      .select("id")
      .eq("year", year)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Year already exists" },
        { status: 409 }
      );
    }

    // Create the year
    const { data, error } = await supabase
      .from("years")
      .insert({ year })
      .select()
      .single();

    if (error) {
      console.error("Error creating year:", error);
      return NextResponse.json(
        { error: "Failed to create year" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Year API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
