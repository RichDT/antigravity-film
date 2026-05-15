-- Rich Picks Film Awards Database Schema

-- Films table: stores all film information
CREATE TABLE IF NOT EXISTS films (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  tmdb_id INTEGER UNIQUE,
  poster_url TEXT,
  backdrop_url TEXT,
  release_year INTEGER,
  overview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Years table: tracks which years have data
CREATE TABLE IF NOT EXISTS years (
  year INTEGER PRIMARY KEY,
  top_film_id UUID REFERENCES films(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Top 10 picks for each year
CREATE TABLE IF NOT EXISTS top_ten_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL REFERENCES years(year) ON DELETE CASCADE,
  film_id UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, rank),
  UNIQUE(year, film_id)
);

-- Categories table: award categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category_group TEXT NOT NULL DEFAULT 'core', -- core, technical, extended, custom
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Category picks: nominees and winners for each category/year
CREATE TABLE IF NOT EXISTS category_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL REFERENCES years(year) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  nominee_name TEXT NOT NULL, -- Person or film name
  nominee_type TEXT NOT NULL DEFAULT 'person', -- person, film, song, etc.
  film_id UUID REFERENCES films(id) ON DELETE SET NULL,
  film_title TEXT, -- For display when film not in database
  is_winner BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- People table: actors, directors, etc. (optional for enhanced search)
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tmdb_id INTEGER UNIQUE,
  profile_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_films_tmdb_id ON films(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_films_title ON films(title);
CREATE INDEX IF NOT EXISTS idx_films_release_year ON films(release_year);
CREATE INDEX IF NOT EXISTS idx_top_ten_picks_year ON top_ten_picks(year);
CREATE INDEX IF NOT EXISTS idx_category_picks_year ON category_picks(year);
CREATE INDEX IF NOT EXISTS idx_category_picks_category ON category_picks(category_id);
CREATE INDEX IF NOT EXISTS idx_category_picks_nominee ON category_picks(nominee_name);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);

-- Enable Row Level Security (public read, admin write)
ALTER TABLE films ENABLE ROW LEVEL SECURITY;
ALTER TABLE years ENABLE ROW LEVEL SECURITY;
ALTER TABLE top_ten_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

-- Public read policies (everyone can read)
CREATE POLICY "Allow public read on films" ON films FOR SELECT USING (true);
CREATE POLICY "Allow public read on years" ON years FOR SELECT USING (is_published = true);
CREATE POLICY "Allow public read on top_ten_picks" ON top_ten_picks FOR SELECT USING (true);
CREATE POLICY "Allow public read on categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read on category_picks" ON category_picks FOR SELECT USING (true);
CREATE POLICY "Allow public read on people" ON people FOR SELECT USING (true);

-- Admin write policies (using service role key bypasses RLS, but we add these for completeness)
-- In practice, admin operations will use the service role key
CREATE POLICY "Allow authenticated insert on films" ON films FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on films" ON films FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on films" ON films FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on years" ON years FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on years" ON years FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on years" ON years FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on top_ten_picks" ON top_ten_picks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on top_ten_picks" ON top_ten_picks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on top_ten_picks" ON top_ten_picks FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on categories" ON categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on categories" ON categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on category_picks" ON category_picks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on category_picks" ON category_picks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on category_picks" ON category_picks FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on people" ON people FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on people" ON people FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on people" ON people FOR DELETE TO authenticated USING (true);
