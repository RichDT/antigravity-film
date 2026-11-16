import YearLens from "@/components/home/YearLens";
import { loadLens } from "@/lib/home-data";

export const revalidate = 3600;

export default async function Page() {
  const data = await loadLens();
  return <YearLens {...data} />;
}
