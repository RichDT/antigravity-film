import HomeClient from "../components/HomeClient";
import { filmsData } from "@/lib/films-data";
import { getAllRichPicksStats, getFilmIdMap, getDBFilmsForDisplay, getTopFilmPerYear } from "@/lib/awards";

export default async function Page() {
  const [dbStats, filmIdMap, dbFilmsData, topFilmsPerYear] = await Promise.all([
    getAllRichPicksStats(),
    getFilmIdMap(),
    getDBFilmsForDisplay(),
    getTopFilmPerYear()
  ]);
  return <HomeClient rawFilmsData={filmsData} dbStats={dbStats} filmIdMap={filmIdMap} dbFilmsData={dbFilmsData} topFilmsPerYear={topFilmsPerYear} />;
}
