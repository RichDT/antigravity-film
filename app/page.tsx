import HomeClient from "../components/HomeClient";
import { filmsData } from "@/lib/films-data";
import { getAllRichPicksStats, getFilmIdMap, getDBFilmsForDisplay, getTopFilmPerYear, getAnticipationBoardFilms } from "@/lib/awards";

export const revalidate = 3600;

export default async function Page() {
  const currentYear = new Date().getFullYear();
  const [dbStats, filmIdMap, dbFilmsData, topFilmsPerYear, anticipationFilms] = await Promise.all([
    getAllRichPicksStats(),
    getFilmIdMap(),
    getDBFilmsForDisplay(),
    getTopFilmPerYear(),
    getAnticipationBoardFilms(currentYear),
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
    />
  );
}
