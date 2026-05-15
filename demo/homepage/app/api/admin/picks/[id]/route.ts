import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Try to delete from top_ten_picks first
    const { error: topTenError } = await supabase
      .from("top_ten_picks")
      .delete()
      .eq("id", id);

    if (!topTenError) {
      return NextResponse.json({ success: true });
    }

    // Try category_picks
    const { error: categoryError } = await supabase
      .from("category_picks")
      .delete()
      .eq("id", id);

    if (categoryError) {
      console.error("Error deleting pick:", categoryError);
      return NextResponse.json(
        { error: "Failed to delete pick" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete pick API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
