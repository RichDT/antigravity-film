import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { YearEditor } from "@/components/admin/year-editor";
import { createClient } from "@/lib/supabase/server";
import { getYearWithDetails, getCategories } from "@/lib/data";

interface YearEditorPageProps {
  params: Promise<{ year: string }>;
}

export default async function YearEditorPage({ params }: YearEditorPageProps) {
  const { year: yearParam } = await params;
  const yearNum = parseInt(yearParam, 10);
  
  // Handle "new" route
  if (yearParam === "new") {
    redirect("/admin/years/new");
  }
  
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
    notFound();
  }
  
  const [yearData, categories] = await Promise.all([
    getYearWithDetails(yearNum),
    getCategories(),
  ]);
  
  if (!yearData) {
    notFound();
  }

  async function updateYear(formData: FormData) {
    "use server";
    
    const supabase = await createClient();
    const notes = formData.get("notes") as string;
    
    const { error } = await supabase
      .from("years")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", yearData!.id);
    
    if (error) {
      console.error("Error updating year:", error);
      throw new Error("Failed to update year");
    }
    
    revalidatePath(`/admin/years/${yearNum}`);
    revalidatePath(`/year/${yearNum}`);
    revalidatePath("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container px-4 py-8">
        <header className="mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          
          <h1 className="font-serif text-3xl font-bold tracking-tight text-primary">
            {yearNum}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Edit top 10 films and category picks for this year.
          </p>
        </header>

        <YearEditor
          year={yearData}
          categories={categories}
          updateYearAction={updateYear}
        />
      </main>
    </div>
  );
}
