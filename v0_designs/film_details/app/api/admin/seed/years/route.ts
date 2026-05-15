import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SAMPLE_YEARS = [
  { year: 2024, notes: "A year of remarkable storytelling and visual innovation." },
  { year: 2023, notes: "Cinema's triumphant return with bold creative visions." },
  { year: 2022, notes: "A diverse year celebrating independent and international cinema." },
  { year: 2021, notes: "Stories of resilience and human connection." },
  { year: 2020, notes: "A transformative year for film distribution and storytelling." },
];

export async function POST() {
  try {
    const supabase = await createClient();

    // Insert years, ignoring conflicts
    for (const yearData of SAMPLE_YEARS) {
      const { error } = await supabase
        .from("years")
        .upsert(yearData, { onConflict: "year" });
      
      if (error) {
        console.error("Error inserting year:", yearData.year, error);
      }
    }

    return NextResponse.json({ success: true, count: SAMPLE_YEARS.length });
  } catch (error) {
    console.error("Seed years error:", error);
    return NextResponse.json(
      { error: "Failed to seed years" },
      { status: 500 }
    );
  }
}
