-- Seed demo data for Rich Picks Film Awards

-- First, seed the categories
INSERT INTO categories (name, slug, description, category_group, display_order) VALUES
  ('Best Picture', 'best-picture', 'Outstanding motion picture of the year', 'core', 1),
  ('Best Director', 'best-director', 'Outstanding achievement in directing', 'core', 2),
  ('Best Actor', 'best-actor', 'Outstanding performance by a lead actor', 'core', 3),
  ('Best Actress', 'best-actress', 'Outstanding performance by a lead actress', 'core', 4),
  ('Best Supporting Actor', 'best-supporting-actor', 'Outstanding performance by a supporting actor', 'core', 5),
  ('Best Supporting Actress', 'best-supporting-actress', 'Outstanding performance by a supporting actress', 'core', 6),
  ('Best Original Screenplay', 'best-original-screenplay', 'Outstanding original screenplay', 'core', 7),
  ('Best Adapted Screenplay', 'best-adapted-screenplay', 'Outstanding adapted screenplay', 'core', 8),
  ('Best Cinematography', 'best-cinematography', 'Outstanding achievement in cinematography', 'technical', 9),
  ('Best Film Editing', 'best-film-editing', 'Outstanding achievement in film editing', 'technical', 10),
  ('Best Original Score', 'best-original-score', 'Outstanding original musical score', 'technical', 11),
  ('Best Production Design', 'best-production-design', 'Outstanding achievement in production design', 'technical', 12),
  ('Best Costume Design', 'best-costume-design', 'Outstanding achievement in costume design', 'technical', 13),
  ('Best Visual Effects', 'best-visual-effects', 'Outstanding achievement in visual effects', 'technical', 14),
  ('Best Animated Feature', 'best-animated-feature', 'Outstanding animated feature film', 'extended', 15),
  ('Best International Feature', 'best-international-feature', 'Outstanding international feature film', 'extended', 16),
  ('Best Documentary Feature', 'best-documentary-feature', 'Outstanding documentary feature', 'extended', 17),
  ('Best Sound', 'best-sound', 'Outstanding achievement in sound', 'technical', 18)
ON CONFLICT (slug) DO NOTHING;

-- Create years
INSERT INTO years (year, is_published) VALUES
  (2024, true), (2023, true), (2022, true), (2019, true), (1999, true), (1994, true), (1972, true)
ON CONFLICT (year) DO NOTHING;

-- Add films
INSERT INTO films (title, release_year, poster_url, overview, tmdb_id) VALUES
-- 2024
('Anora', 2024, 'https://image.tmdb.org/t/p/w500/7MrgIUeq0DD2iF7GR6wqJfYZNeC.jpg', 'A young sex worker from Brooklyn gets her chance at a Cinderella story.', 1064213),
('The Brutalist', 2024, 'https://image.tmdb.org/t/p/w500/zp5AEgMNRlsGoDJkzGhOvGtLMmR.jpg', 'A visionary architect escapes Europe and rebuilds his life in America.', 549509),
('Conclave', 2024, 'https://image.tmdb.org/t/p/w500/m2LJyPPjsPiVu1pHnwdrLhqEijI.jpg', 'Cardinals gather in Vatican City to elect a new Pope.', 974453),
('Dune: Part Two', 2024, 'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', 'Paul Atreides unites with Chani and the Fremen against the Harkonnens.', 693134),
('The Substance', 2024, 'https://image.tmdb.org/t/p/w500/lqoMzCcZYEFK729d6qzt349fB4o.jpg', 'A fading celebrity discovers a black market drug that creates a younger version of herself.', 933260),
('A Real Pain', 2024, 'https://image.tmdb.org/t/p/w500/6WKcbMfKPltHvFrbtfcEFdPzOUP.jpg', 'Two cousins reconnect on a tour through Poland to honor their grandmother.', 1084199),
('Emilia Pérez', 2024, 'https://image.tmdb.org/t/p/w500/qfAfE5auxsuxhxs1V4waFWxMuDz.jpg', 'A cartel boss undergoes gender-affirming surgery to start a new life.', 1063242),
('Wicked', 2024, 'https://image.tmdb.org/t/p/w500/c5Tqxeo1UpBvnAc3csUm7j3hlQl.jpg', 'The untold story of the witches of Oz.', 402431),
('A Complete Unknown', 2024, 'https://image.tmdb.org/t/p/w500/ueESIOwjJqEbOKxuGj9A4SgYmVf.jpg', 'Bob Dylan arrives in New York and changes music forever.', 661539),
('Nosferatu', 2024, 'https://image.tmdb.org/t/p/w500/5qGIxdEO841C0tdY8vOdLoRJiPs.jpg', 'A gothic tale of obsession between a haunted young woman and a terrifying vampire.', 426063),
-- 2023
('Oppenheimer', 2023, 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', 'The story of American physicist J. Robert Oppenheimer and the atomic bomb.', 872585),
('Killers of the Flower Moon', 2023, 'https://image.tmdb.org/t/p/w500/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg', 'The Osage murders and the birth of the FBI.', 466420),
('Poor Things', 2023, 'https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg', 'A young woman is brought back to life by a scientist.', 792307),
('The Holdovers', 2023, 'https://image.tmdb.org/t/p/w500/VHSzNBTwxV8vh7wylo7O9CLdac.jpg', 'A curmudgeon instructor remains at school during Christmas break.', 840430),
('Past Lives', 2023, 'https://image.tmdb.org/t/p/w500/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', 'Two childhood friends reconnect 20 years later.', 666277),
('Anatomy of a Fall', 2023, 'https://image.tmdb.org/t/p/w500/kQs6keheMwCxJxrzV83VUwFtHkB.jpg', 'A woman is suspected of murder after her husband falls from their chalet.', 915935),
('The Zone of Interest', 2023, 'https://image.tmdb.org/t/p/w500/fC1DQVXA3l3KgZqfMBjJEvyqmU8.jpg', 'The commandant of Auschwitz and his family live next to the camp.', 467244),
('American Fiction', 2023, 'https://image.tmdb.org/t/p/w500/46sp1Z9b2PPTgCMyA87g9aTLUXi.jpg', 'A novelist writes a satirical Black book that becomes a bestseller.', 903362),
('May December', 2023, 'https://image.tmdb.org/t/p/w500/ixp4MRjEa7O2BUPmx8cKYl2sT4B.jpg', 'An actress visits a woman to research her tabloid story.', 787699),
('Saltburn', 2023, 'https://image.tmdb.org/t/p/w500/qjhahNLSZ705B5JP92YMEYPocPz.jpg', 'A student becomes obsessed with his aristocratic classmate.', 930564),
-- 2022
('Everything Everywhere All at Once', 2022, 'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg', 'A Chinese immigrant is swept up in an adventure through the multiverse.', 545611),
('The Banshees of Inisherin', 2022, 'https://image.tmdb.org/t/p/w500/7OYHTPtsxRIJVwLEqlIJnhlPrPo.jpg', 'Two lifelong friends find themselves at an impasse.', 674324),
('Tár', 2022, 'https://image.tmdb.org/t/p/w500/7hJYvYmFgPEREWevdkLxnVHTT1Q.jpg', 'A renowned conductor faces allegations that threaten her career.', 817758),
('Elvis', 2022, 'https://image.tmdb.org/t/p/w500/eUBqaUITfL8JaLSgANIgKGWoyhX.jpg', 'The life and music of Elvis Presley.', 614934),
('The Fabelmans', 2022, 'https://image.tmdb.org/t/p/w500/xId9zoiv5WPQOuxqppJP4EMWXGR.jpg', 'Spielberg''s semi-autobiographical coming-of-age story.', 804095),
('All Quiet on the Western Front', 2022, 'https://image.tmdb.org/t/p/w500/hYqOjJ7Gh1fbqXrxlIao1g8ZehF.jpg', 'A young German soldier faces the brutality of World War I.', 143),
('Triangle of Sadness', 2022, 'https://image.tmdb.org/t/p/w500/fgy8dLgdCDRoKMbVXrN6ytuXPLJ.jpg', 'A fashion model celebrity couple are invited on a luxury cruise.', 497828),
('Women Talking', 2022, 'https://image.tmdb.org/t/p/w500/dCOt5LW7xRzthSOvVeXnqoWAEE0.jpg', 'Women in an isolated religious colony grapple with reconciling their faith.', 777245),
('Aftersun', 2022, 'https://image.tmdb.org/t/p/w500/aFSv9P2s3TElRoIUcSGd11096xM.jpg', 'Sophie reflects on a vacation with her father twenty years earlier.', 965150),
('Decision to Leave', 2022, 'https://image.tmdb.org/t/p/w500/ixRJxSzCjjXhiqFuJP1bK02JPVT.jpg', 'A detective investigating a man''s death becomes involved with the widow.', 739547),
-- 2019
('Parasite', 2019, 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', 'A poor family schemes to become employed by a wealthy family.', 496243),
('1917', 2019, 'https://image.tmdb.org/t/p/w500/iZf0KyrE25z1sage4SYFLCCrMi9.jpg', 'Two British soldiers must deliver a message during WWI.', 530915),
('Once Upon a Time in Hollywood', 2019, 'https://image.tmdb.org/t/p/w500/8j58iEBw9pOXFD2L0nt0ZXeHviB.jpg', 'A faded TV actor and his stunt double navigate 1969 Los Angeles.', 466272),
('Marriage Story', 2019, 'https://image.tmdb.org/t/p/w500/pZekG6xabTmZxjmYw10wN84Hp8d.jpg', 'A stage director and his actor wife struggle through divorce.', 492188),
('The Irishman', 2019, 'https://image.tmdb.org/t/p/w500/mbm8k3GFhXS0ROd9AD1gqYbIFbM.jpg', 'A hitman recalls his involvement with the Bufalino crime family.', 398978),
('Jojo Rabbit', 2019, 'https://image.tmdb.org/t/p/w500/7GsM4mtM0worCtIVeiQt28HieeN.jpg', 'A young boy in Hitler''s army discovers his mother is hiding a Jewish girl.', 515001),
('Uncut Gems', 2019, 'https://image.tmdb.org/t/p/w500/jbwYaoYWJwnPLpKUCHRoJi7rDT6.jpg', 'A charismatic jeweler makes a high-stakes bet.', 473033),
('Little Women', 2019, 'https://image.tmdb.org/t/p/w500/mSmiB8XjUnR1GSIljuCPGsk0C1N.jpg', 'Four sisters come of age in America in the aftermath of the Civil War.', 331482),
('Portrait of a Lady on Fire', 2019, 'https://image.tmdb.org/t/p/w500/2LquGwEhbg3soxSCs9VNyh5VJd9.jpg', 'A painter falls in love with the woman whose portrait she''s painting.', 531428),
('The Lighthouse', 2019, 'https://image.tmdb.org/t/p/w500/3nk9UoepYmv1G9oP18q6JJCeYwN.jpg', 'Two lighthouse keepers try to maintain their sanity.', 503919),
-- 1999
('The Matrix', 1999, 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', 'A hacker discovers the true nature of reality.', 603),
('Fight Club', 1999, 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', 'An insomniac office worker forms an underground fight club.', 550),
('Magnolia', 1999, 'https://image.tmdb.org/t/p/w500/sHQWMipOT1X4g5rAFrVE6GCqIqW.jpg', 'A mosaic of interrelated characters in the San Fernando Valley.', 334),
('American Beauty', 1999, 'https://image.tmdb.org/t/p/w500/wby9315QzVKdW9BonAefg8jGTTb.jpg', 'A suburban father has a midlife crisis.', 14),
('The Sixth Sense', 1999, 'https://image.tmdb.org/t/p/w500/fIssD3w3SvIhPPmVo4WMgZDVLID.jpg', 'A boy who communicates with spirits seeks help from a child psychologist.', 745),
('Being John Malkovich', 1999, 'https://image.tmdb.org/t/p/w500/gLhl4XJZX0TJSO2pSJIhOXubT2R.jpg', 'A puppeteer discovers a portal into John Malkovich''s mind.', 492),
('The Talented Mr. Ripley', 1999, 'https://image.tmdb.org/t/p/w500/1H4WoVCOfyyRbWI0ixAKpO5fqLV.jpg', 'A young man insinuates himself into the lifestyle of a wealthy playboy.', 1213),
('Eyes Wide Shut', 1999, 'https://image.tmdb.org/t/p/w500/knLlehHEKABXs9nXoAEBrbwXFuV.jpg', 'A doctor embarks on a harrowing night of sexual obsession.', 345),
('The Insider', 1999, 'https://image.tmdb.org/t/p/w500/wAyJOgrFJ3wCyIOGXdPrPYU85T5.jpg', 'A research chemist blows the whistle on Big Tobacco.', 765),
('Three Kings', 1999, 'https://image.tmdb.org/t/p/w500/apxC5ObiAHuS3xKrHMtBFGFH2FE.jpg', 'Soldiers search for stolen gold at the end of the Gulf War.', 10530),
-- 1994
('Pulp Fiction', 1994, 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', 'Intersecting stories of criminals in Los Angeles.', 680),
('The Shawshank Redemption', 1994, 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', 'Two imprisoned men bond over a number of years.', 278),
('Forrest Gump', 1994, 'https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', 'The history of the United States through the eyes of an Alabama man.', 13),
('Three Colors: Red', 1994, 'https://image.tmdb.org/t/p/w500/3a3wRFYr5lWLyJiR3eDo0ekjLKE.jpg', 'A model discovers her neighbor is a retired judge spying on neighbors.', 36),
('The Lion King', 1994, 'https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg', 'A lion prince flees his kingdom only to learn the true meaning of responsibility.', 8587),
('Ed Wood', 1994, 'https://image.tmdb.org/t/p/w500/hQu7OpXIe6LVqgMYbdqQyxvbz6u.jpg', 'The life of the worst director ever.', 522),
('Hoop Dreams', 1994, 'https://image.tmdb.org/t/p/w500/gpxjoE0yvRwIhFEJgNAZ3zf5b8z.jpg', 'Documentary following two inner-city Chicago boys who dream of becoming NBA players.', 19908),
('Natural Born Killers', 1994, 'https://image.tmdb.org/t/p/w500/xPkG8bnjLQofnfHgiY8iNRWz8eA.jpg', 'Two victims of traumatic childhoods become lovers and mass murderers.', 241),
('Léon: The Professional', 1994, 'https://image.tmdb.org/t/p/w500/yI6X2cCM5YPJtxMhUd3dPGqDAhw.jpg', 'A professional assassin befriends a young girl.', 101),
('Chungking Express', 1994, 'https://image.tmdb.org/t/p/w500/pwQpS1hiqTNKIlxwP6UrZNtPYPz.jpg', 'Two stories of heartbroken Hong Kong cops.', 11104),
-- 1972
('The Godfather', 1972, 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', 'The aging patriarch of an organized crime dynasty transfers control to his son.', 238),
('Cabaret', 1972, 'https://image.tmdb.org/t/p/w500/vkBrQqjFqDrrh4TCoM5W7aNMlYa.jpg', 'A singer in 1931 Berlin falls for a British academic.', 12206),
('Deliverance', 1972, 'https://image.tmdb.org/t/p/w500/p9oSm87sX6OrB0K9NxvL8hhyxEm.jpg', 'Four Atlanta businessmen take a canoe trip that turns deadly.', 5503),
('Solaris', 1972, 'https://image.tmdb.org/t/p/w500/pbXgLEYh8rlG2Km5IGZPnhcnuSz.jpg', 'A psychologist is sent to a space station to investigate strange phenomena.', 593),
('The Discreet Charm of the Bourgeoisie', 1972, 'https://image.tmdb.org/t/p/w500/3xwJIRM3C0NVVUpT1XfvdXMIWjP.jpg', 'Upper-class friends repeatedly find their attempts to have dinner disrupted.', 485),
('Aguirre, the Wrath of God', 1972, 'https://image.tmdb.org/t/p/w500/htrw7weV0hb8i1A7VRzp4eKhjU4.jpg', 'A Spanish conquistador leads a doomed expedition in search of El Dorado.', 945),
('Cries and Whispers', 1972, 'https://image.tmdb.org/t/p/w500/4dqAHM8GJA5fNJHb6IYdNuYkHjF.jpg', 'Three sisters reunite as one dies of cancer.', 8900),
('Pink Flamingos', 1972, 'https://image.tmdb.org/t/p/w500/hR6IWQfvYBOjFLD2fT6jVv2lmJW.jpg', 'A drag queen competes for the title of filthiest person alive.', 7343),
('The Candidate', 1972, 'https://image.tmdb.org/t/p/w500/4lzDhxjbCIbRvvhYLDcDj4OxjB1.jpg', 'A lawyer is persuaded to run for Senate.', 14780),
('Sleuth', 1972, 'https://image.tmdb.org/t/p/w500/ukJyVuVkAkj1Kgez6WJhWi3P8x6.jpg', 'A mystery writer invites his wife''s lover for a game of wits.', 24077)
ON CONFLICT (tmdb_id) DO NOTHING;

-- Add top 10 picks for each year using a DO block
DO $$
DECLARE
  film_rec RECORD;
BEGIN
  -- 2024
  FOR film_rec IN 
    SELECT id, title FROM films WHERE release_year = 2024 
    ORDER BY CASE title 
      WHEN 'Anora' THEN 1 WHEN 'The Brutalist' THEN 2 WHEN 'Conclave' THEN 3 
      WHEN 'Dune: Part Two' THEN 4 WHEN 'The Substance' THEN 5 WHEN 'A Real Pain' THEN 6
      WHEN 'Emilia Pérez' THEN 7 WHEN 'Wicked' THEN 8 WHEN 'A Complete Unknown' THEN 9
      WHEN 'Nosferatu' THEN 10 ELSE 99 END
    LIMIT 10
  LOOP
    INSERT INTO top_ten_picks (year, rank, film_id)
    VALUES (2024, (SELECT COUNT(*)+1 FROM top_ten_picks WHERE year = 2024), film_rec.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 2023
  FOR film_rec IN 
    SELECT id, title FROM films WHERE release_year = 2023 
    ORDER BY CASE title 
      WHEN 'Oppenheimer' THEN 1 WHEN 'Killers of the Flower Moon' THEN 2 WHEN 'Poor Things' THEN 3
      WHEN 'The Holdovers' THEN 4 WHEN 'Past Lives' THEN 5 WHEN 'Anatomy of a Fall' THEN 6
      WHEN 'The Zone of Interest' THEN 7 WHEN 'American Fiction' THEN 8 WHEN 'May December' THEN 9
      WHEN 'Saltburn' THEN 10 ELSE 99 END
    LIMIT 10
  LOOP
    INSERT INTO top_ten_picks (year, rank, film_id)
    VALUES (2023, (SELECT COUNT(*)+1 FROM top_ten_picks WHERE year = 2023), film_rec.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 2022
  FOR film_rec IN 
    SELECT id, title FROM films WHERE release_year = 2022 
    ORDER BY CASE title 
      WHEN 'Everything Everywhere All at Once' THEN 1 WHEN 'The Banshees of Inisherin' THEN 2 
      WHEN 'Tár' THEN 3 WHEN 'Elvis' THEN 4 WHEN 'The Fabelmans' THEN 5
      WHEN 'All Quiet on the Western Front' THEN 6 WHEN 'Triangle of Sadness' THEN 7
      WHEN 'Women Talking' THEN 8 WHEN 'Aftersun' THEN 9 WHEN 'Decision to Leave' THEN 10 
      ELSE 99 END
    LIMIT 10
  LOOP
    INSERT INTO top_ten_picks (year, rank, film_id)
    VALUES (2022, (SELECT COUNT(*)+1 FROM top_ten_picks WHERE year = 2022), film_rec.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 2019
  FOR film_rec IN 
    SELECT id, title FROM films WHERE release_year = 2019 
    ORDER BY CASE title 
      WHEN 'Parasite' THEN 1 WHEN '1917' THEN 2 WHEN 'Once Upon a Time in Hollywood' THEN 3
      WHEN 'Marriage Story' THEN 4 WHEN 'The Irishman' THEN 5 WHEN 'Jojo Rabbit' THEN 6
      WHEN 'Uncut Gems' THEN 7 WHEN 'Little Women' THEN 8 WHEN 'Portrait of a Lady on Fire' THEN 9
      WHEN 'The Lighthouse' THEN 10 ELSE 99 END
    LIMIT 10
  LOOP
    INSERT INTO top_ten_picks (year, rank, film_id)
    VALUES (2019, (SELECT COUNT(*)+1 FROM top_ten_picks WHERE year = 2019), film_rec.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 1999
  FOR film_rec IN 
    SELECT id, title FROM films WHERE release_year = 1999 
    ORDER BY CASE title 
      WHEN 'The Matrix' THEN 1 WHEN 'Fight Club' THEN 2 WHEN 'Magnolia' THEN 3
      WHEN 'American Beauty' THEN 4 WHEN 'The Sixth Sense' THEN 5 WHEN 'Being John Malkovich' THEN 6
      WHEN 'The Talented Mr. Ripley' THEN 7 WHEN 'Eyes Wide Shut' THEN 8 WHEN 'The Insider' THEN 9
      WHEN 'Three Kings' THEN 10 ELSE 99 END
    LIMIT 10
  LOOP
    INSERT INTO top_ten_picks (year, rank, film_id)
    VALUES (1999, (SELECT COUNT(*)+1 FROM top_ten_picks WHERE year = 1999), film_rec.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 1994
  FOR film_rec IN 
    SELECT id, title FROM films WHERE release_year = 1994 
    ORDER BY CASE title 
      WHEN 'Pulp Fiction' THEN 1 WHEN 'The Shawshank Redemption' THEN 2 WHEN 'Forrest Gump' THEN 3
      WHEN 'Three Colors: Red' THEN 4 WHEN 'The Lion King' THEN 5 WHEN 'Ed Wood' THEN 6
      WHEN 'Hoop Dreams' THEN 7 WHEN 'Natural Born Killers' THEN 8 
      WHEN 'Léon: The Professional' THEN 9 WHEN 'Chungking Express' THEN 10 ELSE 99 END
    LIMIT 10
  LOOP
    INSERT INTO top_ten_picks (year, rank, film_id)
    VALUES (1994, (SELECT COUNT(*)+1 FROM top_ten_picks WHERE year = 1994), film_rec.id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 1972
  FOR film_rec IN 
    SELECT id, title FROM films WHERE release_year = 1972 
    ORDER BY CASE title 
      WHEN 'The Godfather' THEN 1 WHEN 'Cabaret' THEN 2 WHEN 'Deliverance' THEN 3
      WHEN 'Solaris' THEN 4 WHEN 'The Discreet Charm of the Bourgeoisie' THEN 5 
      WHEN 'Aguirre, the Wrath of God' THEN 6 WHEN 'Cries and Whispers' THEN 7
      WHEN 'Pink Flamingos' THEN 8 WHEN 'The Candidate' THEN 9 WHEN 'Sleuth' THEN 10 
      ELSE 99 END
    LIMIT 10
  LOOP
    INSERT INTO top_ten_picks (year, rank, film_id)
    VALUES (1972, (SELECT COUNT(*)+1 FROM top_ten_picks WHERE year = 1972), film_rec.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Update years with top film
UPDATE years SET top_film_id = (SELECT film_id FROM top_ten_picks WHERE top_ten_picks.year = years.year AND rank = 1);

-- Add category picks
INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2024, c.id, f.id, 'Mikey Madison', 'person', true, 'A star-making turn'
FROM categories c, films f WHERE c.slug = 'best-actress' AND f.title = 'Anora';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2024, c.id, f.id, 'Adrien Brody', 'person', true, 'Career-best work'
FROM categories c, films f WHERE c.slug = 'best-actor' AND f.title = 'The Brutalist';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2024, c.id, f.id, 'Brady Corbet', 'person', true, 'Epic vision realized'
FROM categories c, films f WHERE c.slug = 'best-director' AND f.title = 'The Brutalist';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2024, c.id, f.id, 'Lol Crawley', 'person', true, 'Stunning VistaVision imagery'
FROM categories c, films f WHERE c.slug = 'best-cinematography' AND f.title = 'The Brutalist';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2023, c.id, f.id, 'Cillian Murphy', 'person', true, 'Haunted and brilliant'
FROM categories c, films f WHERE c.slug = 'best-actor' AND f.title = 'Oppenheimer';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2023, c.id, f.id, 'Emma Stone', 'person', true, 'Uninhibited and transformative'
FROM categories c, films f WHERE c.slug = 'best-actress' AND f.title = 'Poor Things';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2023, c.id, f.id, 'Christopher Nolan', 'person', true, 'His magnum opus'
FROM categories c, films f WHERE c.slug = 'best-director' AND f.title = 'Oppenheimer';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2023, c.id, f.id, 'Hoyte van Hoytema', 'person', true, 'IMAX perfection'
FROM categories c, films f WHERE c.slug = 'best-cinematography' AND f.title = 'Oppenheimer';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2022, c.id, f.id, 'Michelle Yeoh', 'person', true, 'Everything bagel energy'
FROM categories c, films f WHERE c.slug = 'best-actress' AND f.title = 'Everything Everywhere All at Once';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2022, c.id, f.id, 'Austin Butler', 'person', true, 'He became Elvis'
FROM categories c, films f WHERE c.slug = 'best-actor' AND f.title = 'Elvis';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2022, c.id, f.id, 'Daniel Kwan, Daniel Scheinert', 'person', true, 'Multiversal madness'
FROM categories c, films f WHERE c.slug = 'best-director' AND f.title = 'Everything Everywhere All at Once';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2019, c.id, f.id, 'Bong Joon-ho', 'person', true, 'Genre-defying masterwork'
FROM categories c, films f WHERE c.slug = 'best-director' AND f.title = 'Parasite';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2019, c.id, f.id, 'Adam Driver', 'person', true, 'Raw vulnerability'
FROM categories c, films f WHERE c.slug = 'best-actor' AND f.title = 'Marriage Story';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2019, c.id, f.id, 'Scarlett Johansson', 'person', true, 'Devastating'
FROM categories c, films f WHERE c.slug = 'best-actress' AND f.title = 'Marriage Story';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 2019, c.id, f.id, 'Roger Deakins', 'person', true, 'One-shot wonder'
FROM categories c, films f WHERE c.slug = 'best-cinematography' AND f.title = '1917';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 1999, c.id, f.id, 'The Wachowskis', 'person', true, 'Redefined cinema'
FROM categories c, films f WHERE c.slug = 'best-director' AND f.title = 'The Matrix';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 1994, c.id, f.id, 'Quentin Tarantino', 'person', true, 'Changed everything'
FROM categories c, films f WHERE c.slug = 'best-director' AND f.title = 'Pulp Fiction';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 1972, c.id, f.id, 'Francis Ford Coppola', 'person', true, 'An offer cinema couldn''t refuse'
FROM categories c, films f WHERE c.slug = 'best-director' AND f.title = 'The Godfather';

INSERT INTO category_picks (year, category_id, film_id, nominee_name, nominee_type, is_winner, notes)
SELECT 1972, c.id, f.id, 'Marlon Brando', 'person', true, 'The Don'
FROM categories c, films f WHERE c.slug = 'best-actor' AND f.title = 'The Godfather';
