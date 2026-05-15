import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, subject, body: messageBody, email, pageUrl } = body;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("feedback")
      .insert([
        {
          type,
          subject,
          body: messageBody,
          email: email || null,
          page_url: pageUrl || null,
        },
      ]);

    if (error) {
      console.error("Error inserting feedback:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
