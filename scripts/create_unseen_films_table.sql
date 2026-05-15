-- Films that Rich Picks did not screen/review for a given awards year.
-- Stores only manually-added entries; auto-populated entries come from live
-- nominations queries in lib/unseen-films.ts.
--
-- Run once against the production DB via psql or the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS unseen_films (
  unseen_film_id SERIAL PRIMARY KEY,
  film_id        INTEGER NOT NULL REFERENCES films(film_id),
  year           INTEGER NOT NULL,  -- awards year (may differ from film release_year)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(film_id, year)
);

CREATE INDEX IF NOT EXISTS idx_unseen_films_year ON unseen_films(year);
