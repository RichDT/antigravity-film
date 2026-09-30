import HomeClient from "../components/HomeClient";
import { filmsData } from "@/lib/films-data";
import { getAllRichPicksStats, getFilmIdMap, getDBFilmsForDisplay, getTopFilmPerYear, getAnticipationBoardFilms, getConsiderationCounts } from "@/lib/awards";

export const revalidate = 3600;

export default async function Page() {
  const currentYear = new Date().getFullYear();
  const [dbStats, filmIdMap, dbFilmsData, topFilmsPerYear, anticipationFilms, considerationCounts] = await Promise.all([
    getAllRichPicksStats(),
    getFilmIdMap(),
    getDBFilmsForDisplay(),
    getTopFilmPerYear(),
    getAnticipationBoardFilms(currentYear),
    getConsiderationCounts(currentYear),
  ]);
  return (
    <HomeClient
      rawFilmsData={filmsData}
      dbStats={dbStats}
      filmIdMap={filmIdMap}
      dbFilmsData={dbFilmsData}
      topFilmsPerYear={topFilmsPerYear}
      anticipationFilms={anticipationFilms}
      anticipationYear={currentYear}
      considerationCounts={considerationCounts}
    />
  );
}
