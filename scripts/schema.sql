CREATE TABLE organizations (
    organization_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    country TEXT,
    founded_year INTEGER,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE awards (
    award_id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(organization_id),
    name TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ceremonies (
    ceremony_id SERIAL PRIMARY KEY,
    award_id INTEGER REFERENCES awards(award_id),
    year INTEGER NOT NULL,
    ceremony_number INTEGER,
    date DATE,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(award_id, year)
);

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    award_id INTEGER REFERENCES awards(award_id),
    name TEXT NOT NULL,
    introduced_year INTEGER,
    retired_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE films (
    film_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    release_year INTEGER,
    original_language TEXT,
    country TEXT,
    runtime_minutes INTEGER,
    imdb_id TEXT,
    tmdb_id INTEGER,
    wikipedia_url TEXT,
    budget TEXT,
    box_office TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE people (
    person_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    appendix TEXT,
    is_inverted_name BOOLEAN DEFAULT false,
    birth_date DATE,
    death_date DATE,
    gender TEXT,
    imdb_id TEXT,
    tmdb_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE
);

CREATE TABLE songs (
    song_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    film_id INTEGER REFERENCES films(film_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nominations (
    nomination_id SERIAL PRIMARY KEY,
    ceremony_id INTEGER REFERENCES ceremonies(ceremony_id),
    category_id INTEGER REFERENCES categories(category_id),
    film_id INTEGER REFERENCES films(film_id),
    win BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nomination_people (
    nomination_person_id SERIAL PRIMARY KEY,
    nomination_id INTEGER REFERENCES nominations(nomination_id),
    person_id INTEGER REFERENCES people(person_id),
    role_id INTEGER REFERENCES roles(role_id),
    credit_order INTEGER,
    UNIQUE(nomination_id, person_id, role_id)
);

CREATE TABLE nomination_songs (
    nomination_id INTEGER REFERENCES nominations(nomination_id),
    song_id INTEGER REFERENCES songs(song_id),
    PRIMARY KEY(nomination_id, song_id)
);

CREATE TABLE film_crew (
    film_crew_id SERIAL PRIMARY KEY,
    film_id INTEGER REFERENCES films(film_id),
    person_id INTEGER REFERENCES people(person_id),
    crew_role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(film_id, person_id, crew_role)
);
