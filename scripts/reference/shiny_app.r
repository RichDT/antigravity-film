#
# Rich Picks Shiny App – Optimized Version
#

library(dplyr)
library(shiny)
# library(devtools)   # not needed at runtime
 library(tidyverse)
library(stringr)
library(ggplot2)
library(gt)
library(bslib)
library(scales)
# library(usethis)    # not needed at runtime

# ─────────────────────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────────────────────

load("data/c.rda")
load("data/d.rda")
load("data/e.rda")
load("data/p.rda")
load("data/ref.rda")
load("data/sag.rda")
load("data/pga.rda")
load("data/dga.rda")
load("data/ves.rda")
load("data/asc.rda")
load("data/ace.rda")
load("data/adg.rda")
load("data/cdg.rda")
load("data/wga.rda")
load("data/mpse.rda")
load("data/cas.rda")
load("data/muah.rda")
load("data/scl.rda")
load("data/grammy.rda")
load("data/annie.rda")
load("data/bafta.rda")
load("data/globe.rda")
load("data/globe.concord.rda")
load("data/oscar.rda")
load("data/oscar.concord.rda")

# Robust, vectorized award helper: create icon keys
wrap_award <- function(win, slant, prefix) {
  win   <- as.logical(win)
  slant <- as.logical(slant)
  
  dplyr::case_when(
    # if win is NA, no icon at all
    is.na(win) ~ NA_character_,
    
    win &  slant ~ paste0(prefix, "_won_slant"),
    !win & slant ~ paste0(prefix, "_nom_slant"),
    win          ~ paste0(prefix, "_won"),
    !win         ~ paste0(prefix, "_nom")
  )
}

# ─────────────────────────────────────────────────────────────
# Guild labels
# ─────────────────────────────────────────────────────────────

sag  <- sag  %>% mutate(guild = "Screen Actors' Guild",              acronym = "SAG")
pga  <- pga  %>% mutate(guild = "Producers' Guild of America",       acronym = "PGA")
dga  <- dga  %>% mutate(guild = "Directors' Guild of America",       acronym = "DGA")
ves  <- ves  %>% mutate(guild = "Visual Effects' Society",           acronym = "VES")

asc  <- asc  %>% mutate(guild = "American Society of Cinematographers", acronym = "ASC")
ace  <- ace  %>% mutate(guild = "American Cinema Editors",           acronym = "ACE")
adg  <- adg  %>% mutate(guild = "Art Directors' Guild",              acronym = "ADG")
cdg  <- cdg  %>% mutate(guild = "Costume Designers' Guild",          acronym = "CDG")

wga  <- wga  %>% mutate(guild = "Writers' Guild of America",         acronym = "WGA")
mpse <- mpse %>% mutate(guild = "Motion Picture Sound Editors",      acronym = "MPSE")
cas  <- cas  %>% mutate(guild = "Cinema Audio Society",              acronym = "CAS")
muah <- muah %>% mutate(guild = "Make-Up and Hairstyling",           acronym = "MUAH")

scl  <- scl  %>% mutate(guild = "Society of Composers & Lyricists",  acronym = "SCL")

guilds <- bind_rows(
  sag, pga, dga, ves,
  asc, ace, adg, cdg,
  wga, mpse, cas, muah,
  scl
)

# ─────────────────────────────────────────────────────────────
# Film grades
# ─────────────────────────────────────────────────────────────

d <- d %>%
  mutate(
    Grade = gsub(pattern = " // ", replacement = "//", x = Grade, fixed = TRUE),
    Grade = factor(
      Grade,
      levels = c(
        "A+", "A+//A",
        "A", "A//A-",
        "A-", "A-//B+",
        "B+", "B+//B",
        "B", "B//B-",
        "B-", "B-//C+",
        "C+", "C+//C",
        "C", "C//C-",
        "C-", "C-//D+",
        "D+", "D+//D",
        "D", "D//D-",
        "D-", "D-//E+",
        "E+", "E+//E",
        "E", "E//E-",
        "E-", "E-//F+",
        "F+", "F+//F",
        "F", "F//F-",
        "F-"
      ),
      ordered = TRUE
    )
  )

# ─────────────────────────────────────────────────────────────
# Main nominations table `c` (unchanged logic; heavy prep)
# ─────────────────────────────────────────────────────────────

c <-
  c %>%
  mutate(
    p_id = case_when(is.na(p_id) ~ "p001812", TRUE ~ p_id)
  ) %>% 
  merge(
    y = p %>%
      dplyr::select(Nominee, p_id) %>%
      filter(!is.na(Nominee)),
    by = "p_id",
    all.x = TRUE
  ) %>% 
  mutate(
    Nominee_Lower = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
    Film_Lower    = str_replace_all(tolower(Film),    "[[:punct:]]", ""),
    Title_lower   = str_replace_all(tolower(Title),   "[[:punct:]]", "")
  ) %>% 
  merge(
    y = guilds %>%
      filter(acronym != "SAG") %>%
      filter(Concordance != "Original Song") %>%
      dplyr::select("Film", "Year", "Concordance", "Won") %>%
      mutate(
        Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
      ) %>%
      distinct(),
    by.x  = c("Year", "Film_Lower", "Category"),
    by.y  = c("Year", "Film", "Concordance"),
    all.x = TRUE
  ) %>%
  merge(
    y = guilds %>%
      filter(acronym == "SAG") %>%
      dplyr::select("Nominee", "Film", "Year", "Concordance", "Won") %>%
      mutate(
        Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
        Film    = str_replace_all(tolower(Film),    "[[:punct:]]", "")
      ) %>%
      distinct(),
    by.x  = c("Year", "Film_Lower", "Category", "Nominee_Lower"),
    by.y  = c("Year", "Film", "Concordance", "Nominee"),
    all.x = TRUE
  ) %>%
  merge(
    y     = e,
    by    = "Category",
    all.x = TRUE
  ) %>%
  mutate(
    Won = case_when(
      Division == "Acting" ~ Won.y,
      TRUE                 ~ Won.x
    )
  ) %>%
  dplyr::select(!c("Won.x", "Won.y")) %>%
  merge(
    y = guilds %>%
      filter(acronym %in% c("SAG", "WGA"), !is.na(Concordance)) %>%
      dplyr::select("Nominee", "Film", "Year", "Concordance", "Won") %>%
      mutate(
        Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
        Film    = str_replace_all(tolower(Film),    "[[:punct:]]", "")
      ) %>%
      distinct(),
    by.x  = c("Year", "Film_Lower", "Nominee_Lower"),
    by.y  = c("Year", "Film", "Nominee"),
    all.x = TRUE
  ) %>%
  mutate(
    Won = case_when(
      Division == "Writing" & is.na(Won.x) & !is.na(Won.y) ~ Won.y,
      Division == "Acting"  & is.na(Won.x) & !is.na(Won.y) ~ Won.y,
      TRUE ~ Won.x
    ),
    Concordance = case_when(
      Division == "Writing" & is.na(Won.x) & !is.na(Won.y) ~ TRUE,
      Division == "Acting"  & is.na(Won.x) & !is.na(Won.y) ~ TRUE,
      Division == "Writing" & !is.na(Won.x) ~ FALSE,
      Division == "Acting"  & !is.na(Won.x) ~ FALSE,
      TRUE ~ NA
    )
  ) %>%
  dplyr::select(!c("Won.x", "Won.y")) %>%
  rename(Won_Guild.Slant = Concordance) %>%
  merge(
    y = guilds %>%
      filter(acronym == "SCL" & Concordance == "Original Song") %>%
      dplyr::select("Film", "Concordance", "Won", "Song_Title") %>%
      mutate(
        Film       = str_replace_all(tolower(Film), "[[:punct:]]", ""),
        Song_Title = str_replace_all(tolower(Song_Title), "[[:punct:]]", "")
      ) %>%
      distinct(),
    by.x  = c("Film_Lower", "Category", "Title_lower"),
    by.y  = c("Film", "Concordance", "Song_Title"),
    all.x = TRUE
  ) %>%
  mutate(
    Won = case_when(
      Category == "Original Song" ~ Won.y,
      TRUE                        ~ Won.x
    )
  ) %>%
  dplyr::select(!c("Won.x", "Won.y")) %>%
  rename(Won_Guild = Won) %>% 
  merge(
    y = grammy %>%
      dplyr::select("Film", "Concordance", "Won", "Song") %>%
      mutate(
        Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
        Song = str_replace_all(tolower(Song), "[[:punct:]]", "")
      ) %>%
      distinct(),
    by.x  = c("Film_Lower", "Category", "Title_lower"),
    by.y  = c("Film", "Concordance", "Song"),
    all.x = TRUE
  ) %>%
  rename(Won_Grammy = Won) %>%
  merge(
    y = annie %>%
      dplyr::select("Year", "Film", "Concordance", "Won") %>%
      mutate(Film = str_replace_all(tolower(Film), "[[:punct:]]", "")) %>%
      distinct(),
    by.x  = c("Year", "Film_Lower", "Category"),
    by.y  = c("Year", "Film", "Concordance"),
    all.x = TRUE
  ) %>%
  rename(Won_Annie = Won) %>%
  merge(
    y = bafta %>%
      filter(!str_starts(Concordance, "Act")) %>%
      dplyr::select("Year", "Film", "Concordance", "Won") %>%
      mutate(Film = str_replace_all(tolower(Film), "[[:punct:]]", "")) %>%
      distinct(),
    by.x  = c("Year", "Film_Lower", "Category"),
    by.y  = c("Year", "Film", "Concordance"),
    all.x = TRUE
  ) %>%
  merge(
    y = bafta %>%
      filter(str_starts(Concordance, "Act")) %>%
      dplyr::select("Year", "Film", "Concordance", "Nominee", "Won") %>%
      mutate(
        Film    = str_replace_all(tolower(Film),    "[[:punct:]]", ""),
        Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", "")
      ) %>%
      distinct(),
    by.x  = c("Year", "Film_Lower", "Category", "Nominee_Lower"),
    by.y  = c("Year", "Film", "Concordance", "Nominee"),
    all.x = TRUE
  ) %>%
  merge(
    y = bafta %>%
      filter(
        str_starts(Concordance, "Act") |
          str_detect(Concordance, "Screenplay")
      ) %>%
      dplyr::select("Year", "Film", "Nominee", "Won") %>%
      mutate(
        Film    = str_replace_all(tolower(Film),    "[[:punct:]]", ""),
        Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", "")
      ) %>%
      distinct(),
    by.x  = c("Year", "Film_Lower", "Nominee_Lower"),
    by.y  = c("Year", "Film", "Nominee"),
    all.x = TRUE
  ) %>%
  mutate(
    Won_BAFTA = case_when(
      !is.na(Won.x) ~ as.logical(Won.x),
      !is.na(Won.y) ~ as.logical(Won.y),
      Division == "Writing" & !is.na(Won) & is.na(Won.x) ~ as.logical(Won),
      Division == "Acting"  & !is.na(Won) & is.na(Won.y) ~ as.logical(Won),
      TRUE ~ NA
    ),
    Won_BAFTA.Slant = case_when(
      !is.na(Won.x) ~ NA,
      !is.na(Won.y) ~ FALSE,
      Division == "Writing" & !is.na(Won) & is.na(Won.x) ~ TRUE,
      Division == "Acting"  & !is.na(Won) & is.na(Won.y) ~ TRUE,
      TRUE ~ NA
    )
  ) %>%
  dplyr::select(!c(Won.x, Won.y, Won)) %>%
  merge(
    y = globe %>%
      filter(
        !str_starts(Category_Globes, "Best Performance"),
        !str_starts(Category_Globes, "Best Original Song")
      ) %>%
      dplyr::select("Year", "Film", "Category_Globes", "Win_Globe") %>%
      mutate(Film = str_replace_all(tolower(Film), "[[:punct:]]", "")) %>%
      distinct() %>%
      merge(y = globe.concord, by = "Category_Globes", all.x = TRUE) %>%
      dplyr::select(!Category_Globes),
    by.x  = c("Year", "Film_Lower", "Category"),
    by.y  = c("Year", "Film", "Category"),
    all.x = TRUE
  ) %>%
  merge(
    y = globe %>%
      filter(
        str_starts(Category_Globes, "Best Performance") |
          str_starts(Category_Globes, "Best Original Song")
      ) %>%
      dplyr::select("Year", "Film", "Category_Globes", "Nominee", "Win_Globe", "Song_Title") %>%
      mutate(
        Film       = str_replace_all(tolower(Film),       "[[:punct:]]", ""),
        Nominee    = str_replace_all(tolower(Nominee),    "[[:punct:]]", ""),
        Song_Title = str_remove_all(Song_Title, stringr::regex("\"|\"")) %>%
          tolower() %>%
          str_replace_all("[[:punct:]]", "")
      ) %>%
      distinct() %>%
      merge(y = globe.concord, by = "Category_Globes", all.x = TRUE) %>%
      dplyr::select(!Category_Globes),
    by.x  = c("Year", "Film_Lower", "Category", "Nominee_Lower", "Title_lower"),
    by.y  = c("Year", "Film", "Category", "Nominee", "Song_Title"),
    all.x = TRUE
  ) %>%
  merge(
    y = globe %>%
      filter(str_starts(Category_Globes, "Best Performance")) %>%
      dplyr::select("Year", "Film", "Category_Globes", "Nominee", "Win_Globe") %>%
      mutate(
        Film    = str_replace_all(tolower(Film),    "[[:punct:]]", ""),
        Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", "")
      ) %>%
      distinct() %>%
      merge(y = globe.concord, by = "Category_Globes", all.x = TRUE) %>%
      dplyr::select(!Category_Globes) %>%
      filter(!is.na(Category)) %>%
      dplyr::select(!Category),
    by.x  = c("Year", "Film_Lower", "Nominee_Lower"),
    by.y  = c("Year", "Film", "Nominee"),
    all.x = TRUE
  ) %>%
  mutate(
    Won_Globe = case_when(
      !is.na(Win_Globe.x) ~ as.logical(Win_Globe.x),
      !is.na(Win_Globe.y) ~ as.logical(Win_Globe.y),
      Division == "Acting" & !is.na(Win_Globe) & is.na(Win_Globe.y) ~ as.logical(Win_Globe),
      TRUE ~ NA
    ),
    Won_Globe.Slant = case_when(
      !is.na(Win_Globe.x) ~ NA,
      !is.na(Win_Globe.y) ~ FALSE,
      Division == "Acting" & !is.na(Win_Globe) & is.na(Win_Globe.y) ~ TRUE,
      TRUE ~ NA
    )
  ) %>%
  dplyr::select(!c(Win_Globe.x, Win_Globe.y, Win_Globe)) %>%
  merge(
    y = oscar %>%
      filter(
        !str_starts(Category_Oscar, "Act"),
        !str_detect(Category_Oscar, "Original Song")
      ) %>%
      dplyr::select("Year", "Film", "Category_Oscar", "Win_Oscar") %>%
      mutate(Film = str_replace_all(tolower(Film), "[[:punct:]]", "")) %>%
      distinct() %>%
      merge(y = oscar.concord, by.x = "Category_Oscar", by.y = "Oscars", all.x = TRUE) %>%
      dplyr::select(!Category_Oscar),
    by.x  = c("Year", "Film_Lower", "Category"),
    by.y  = c("Year", "Film", "Category"),
    all.x = TRUE
  ) %>%
  merge(
    y = oscar %>%
      filter(
        str_starts(Category_Oscar, "Act") |
          str_detect(Category_Oscar, "Original Song")
      ) %>%
      dplyr::select("Year", "Film", "Category_Oscar", "Nominee", "Win_Oscar", "Song.Title") %>%
      mutate(
        Film       = str_replace_all(tolower(Film),       "[[:punct:]]", ""),
        Nominee    = str_replace_all(tolower(Nominee),    "[[:punct:]]", ""),
        Song.Title = str_remove_all(Song.Title, stringr::regex("\"|\"")) %>%
          tolower() %>%
          str_replace_all("[[:punct:]]", "")
      ) %>%
      distinct() %>%
      merge(y = oscar.concord, by.x = "Category_Oscar", by.y = "Oscars", all.x = TRUE) %>%
      dplyr::select(!Category_Oscar),
    by.x  = c("Year", "Film_Lower", "Category", "Nominee_Lower", "Title_lower"),
    by.y  = c("Year", "Film", "Category", "Nominee", "Song.Title"),
    all.x = TRUE
  ) %>%
  merge(
    y = oscar %>%
      filter(
        str_starts(Category_Oscar, "Act") |
          str_detect(Category_Oscar, "Screenplay")
      ) %>%
      dplyr::select("Year", "Film", "Category_Oscar", "Nominee", "Win_Oscar") %>%
      mutate(
        Film    = str_replace_all(tolower(Film),    "[[:punct:]]", ""),
        Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
        Division = case_when(
          str_starts(Category_Oscar, "Act")            ~ "Acting",
          str_detect(Category_Oscar, "Screenplay")     ~ "Writing",
          TRUE                                         ~ NA_character_
        )
      ) %>%
      distinct() %>%
      merge(y = oscar.concord, by.x = "Category_Oscar", by.y = "Oscars", all.x = TRUE) %>%
      dplyr::select(!Category_Oscar) %>%
      filter(!is.na(Category)) %>%
      dplyr::select(!Category),
    by.x  = c("Year", "Film_Lower", "Nominee_Lower", "Division"),
    by.y  = c("Year", "Film", "Nominee", "Division"),
    all.x = TRUE
  ) %>%
  mutate(
    Won_Oscar = case_when(
      !is.na(Win_Oscar.x) ~ as.logical(Win_Oscar.x),
      !is.na(Win_Oscar.y) ~ as.logical(Win_Oscar.y),
      Division == "Writing" & !is.na(Win_Oscar) & is.na(Win_Oscar.x) ~ as.logical(Win_Oscar),
      Division == "Acting"  & !is.na(Win_Oscar) & is.na(Win_Oscar.y) ~ as.logical(Win_Oscar),
      TRUE ~ NA
    ),
    Won_Oscar.Slant = case_when(
      !is.na(Win_Oscar.x) ~ NA,
      !is.na(Win_Oscar.y) ~ FALSE,
      Division == "Writing" & !is.na(Win_Oscar) & is.na(Win_Oscar.x) ~ TRUE,
      Division == "Acting"  & !is.na(Win_Oscar) & is.na(Win_Oscar.y) ~ TRUE,
      TRUE ~ NA
    )
  ) %>%
  dplyr::select(!c(Win_Oscar.x, Win_Oscar.y, Win_Oscar)) %>%
  mutate(
    Nominee = case_when(
      Category %in% c("Art Direction", "Screenplay (Original)") & !is.na(Role) ~
        paste0(Nominee, " (", Role, ")"),
      TRUE ~ Nominee
    ),
    Role = case_when(
      Category %in% c("Art Direction", "Screenplay (Original)") ~ NA_character_,
      TRUE                                                       ~ Role
    )
  ) %>%
  group_by(
    Year, Film_Lower, Category,
    Nominee_Lower, Film,
    Nominee, Outcome, Nominated,
    Title, Role,
    Won_Oscar, Won_Grammy, Won_Annie, Won_BAFTA, Won_Globe
  ) %>%
  mutate(dupe = n()) %>%
  ungroup() %>%
  filter(!(dupe > 1 & Won_Guild == FALSE))

# ─────────────────────────────────────────────────────────────
# Global constants and precomputed tables
# ─────────────────────────────────────────────────────────────

current.year <- Sys.Date() %>%
  as.character() %>%
  substr(1, 4) %>%
  as.numeric()

# Nominations-only base (used in multiple places)
c_noms <- c %>%
  filter(Nominated == "TRUE", !is.na(Film)) %>%
  select(
    Year, Film, Category, Nominee,
    Outcome,
    Won_Oscar, Won_Oscar.Slant,
    Won_Guild, Won_Guild.Slant,
    Won_Grammy, Won_Annie,
    Won_BAFTA, Won_BAFTA.Slant,
    Won_Globe, Won_Globe.Slant,
    Role, Title
  )

# Search base with context icons, grouped by nominee & film
c.bound <- c_noms %>%
  group_by(
    Year, Film, Category,
    Outcome,
    Won_Oscar, Won_Oscar.Slant,
    Won_Guild, Won_Guild.Slant,
    Won_Grammy, Won_Annie,
    Won_BAFTA, Won_BAFTA.Slant,
    Won_Globe, Won_Globe.Slant,
    Role, Title
  ) %>%
  summarise(Nominee = paste(Nominee, collapse = ", "), .groups = "drop") %>%
  group_by(
    Year, Nominee, Category, Outcome,
    Won_Oscar, Won_Oscar.Slant,
    Won_Guild, Won_Guild.Slant,
    Won_Grammy, Won_Annie,
    Won_BAFTA, Won_BAFTA.Slant,
    Won_Globe, Won_Globe.Slant
  ) %>%
  summarise(Film = paste(Film, collapse = ", "), .groups = "drop") %>%
  mutate(
    Won_Oscar = as.logical(Won_Oscar),
    Oscar = case_when(
      Won_Oscar  & Won_Oscar.Slant  ~ "oscar_won_slant",
      !Won_Oscar & Won_Oscar.Slant  ~ "oscar_nom_slant",
      Won_Oscar                     ~ "oscar_won",
      !Won_Oscar                    ~ "oscar_nom",
      TRUE                          ~ NA_character_
    ),
    Guild = case_when(
      Won_Guild == TRUE  & Won_Guild.Slant  ~ "award_won_slant",
      Won_Guild == FALSE & Won_Guild.Slant  ~ "award_nom_slant",
      Won_Guild == TRUE                     ~ "award_won",
      Won_Guild == FALSE                    ~ "award_nom",
      TRUE                                  ~ NA_character_
    ),
    BAFTA = case_when(
      Won_BAFTA == TRUE  & Won_BAFTA.Slant  ~ "bafta_won_slant",
      Won_BAFTA == FALSE & Won_BAFTA.Slant  ~ "bafta_nom_slant",
      Won_BAFTA == TRUE                     ~ "bafta_won",
      Won_BAFTA == FALSE                    ~ "bafta_nom",
      TRUE                                  ~ NA_character_
    ),
    Grammy = case_when(
      Won_Grammy == TRUE  ~ "grammy_won",
      Won_Grammy == FALSE ~ "grammy_nom",
      TRUE                ~ NA_character_
    ),
    Annie = case_when(
      Won_Annie == TRUE  ~ "annie_won",
      Won_Annie == FALSE ~ "annie_nom",
      TRUE               ~ NA_character_
    ),
    Globe = case_when(
      Won_Globe == TRUE  & Won_Globe.Slant  ~ "globe_won_slant",
      Won_Globe == FALSE & Won_Globe.Slant  ~ "globe_nom_slant",
      Won_Globe == TRUE                     ~ "globe_won",
      Won_Globe == FALSE                    ~ "globe_nom",
      TRUE                                  ~ NA_character_
    )
  ) %>%
  tidyr::unite(
    col   = "Context",
    Oscar, BAFTA, Guild, Globe, Annie, Grammy,
    na.rm = TRUE,
    sep   = ", "
  ) %>%
  mutate(
    Context = if_else(Context == "", NA_character_, Context)
  )

# Yearly Awards base with all heavy transformations precomputed
yearly_awards_base <- c_noms %>%
  group_by(
    Year, Film, Category,
    Outcome,
    Won_Oscar, Won_Oscar.Slant,
    Won_Guild, Won_Guild.Slant,
    Won_Grammy, Won_Annie,
    Won_BAFTA, Won_BAFTA.Slant,
    Won_Globe, Won_Globe.Slant,
    Role, Title
  ) %>%
  summarise(
    Nominee = paste(Nominee, collapse = ", "),
    .groups = "drop"
  ) %>%
  group_by(
    Year, Film, Category, Nominee,
    Outcome, Title,
    Won_Oscar, Won_Oscar.Slant,
    Won_Guild, Won_Guild.Slant,
    Won_Grammy, Won_Annie,
    Won_BAFTA, Won_BAFTA.Slant,
    Won_Globe, Won_Globe.Slant
  ) %>%
  summarise(
    Role = paste(Role, collapse = ", "),
    .groups = "drop"
  ) %>%
  mutate(
    Nominee = case_when(
      str_starts(Category, "Act") ~
        paste(Nominee, "\n", "as ", Role, sep = ""),
      Category == "Original Song" ~
        paste(Nominee, "\nfor '", Title, "'", sep = ""),
      TRUE ~ Nominee
    ),
    Film = case_when(
      str_detect(Category, "Adapted") ~
        paste(Film, "\n(based on: ", Title, ")", sep = ""),
      TRUE ~ Film
    ),
    Won_Oscar = as.logical(Won_Oscar),
    Oscar = case_when(
      Won_Oscar  & Won_Oscar.Slant  ~ "oscar_won_slant",
      !Won_Oscar & Won_Oscar.Slant  ~ "oscar_nom_slant",
      Won_Oscar                     ~ "oscar_won",
      !Won_Oscar                    ~ "oscar_nom",
      TRUE                          ~ NA_character_
    ),
    Guild = case_when(
      Won_Guild == TRUE  & Won_Guild.Slant  ~ "award_won_slant",
      Won_Guild == FALSE & Won_Guild.Slant  ~ "award_nom_slant",
      Won_Guild == TRUE                     ~ "award_won",
      Won_Guild == FALSE                    ~ "award_nom",
      TRUE                                  ~ NA_character_
    ),
    BAFTA = case_when(
      Won_BAFTA == TRUE  & Won_BAFTA.Slant  ~ "bafta_won_slant",
      Won_BAFTA == FALSE & Won_BAFTA.Slant  ~ "bafta_nom_slant",
      Won_BAFTA == TRUE                     ~ "bafta_won",
      Won_BAFTA == FALSE                    ~ "bafta_nom",
      TRUE                                  ~ NA_character_
    ),
    Grammy = case_when(
      Won_Grammy == TRUE  ~ "grammy_won",
      Won_Grammy == FALSE ~ "grammy_nom",
      TRUE                ~ NA_character_
    ),
    Annie = case_when(
      Won_Annie == TRUE  ~ "annie_won",
      Won_Annie == FALSE ~ "annie_nom",
      TRUE               ~ NA_character_
    ),
    Globe = case_when(
      Won_Globe == TRUE  & Won_Globe.Slant  ~ "globe_won_slant",
      Won_Globe == FALSE & Won_Globe.Slant  ~ "globe_nom_slant",
      Won_Globe == TRUE                     ~ "globe_won",
      Won_Globe == FALSE                    ~ "globe_nom",
      TRUE                                  ~ NA_character_
    )
  ) %>%
  tidyr::unite(
    col   = "Context",
    Oscar, BAFTA, Guild, Globe, Annie, Grammy,
    na.rm = TRUE,
    sep   = ", "
  ) %>%
  mutate(
    Context = if_else(Context == "", NA_character_, Context)
  )

# Film-level awards summary (for Top 10 tab)
film_awards_summary <- c_noms %>%
  distinct(Year, Film, Category, Outcome) %>%
  group_by(Year, Film, Category) %>%
  summarise(
    has_win = any(Outcome == "Won"),
    .groups = "drop"
  ) %>%
  group_by(Year, Film) %>%
  summarise(
    Nominations = n(),
    Wins        = sum(has_win),
    .groups     = "drop"
  )

top10_base <- d %>%
  select(Year, Film, Grade) %>%
  distinct() %>%
  left_join(film_awards_summary, by = c("Year", "Film"))

# ─────────────────────────────────────────────────────────────
# Shiny app
# ─────────────────────────────────────────────────────────────

myApp <- function(...) {
  
  bg.col       <- "#654F4F"
  row.head.col <- "#573D3D"
  highlight.col <- scales::alpha("#FFD700", alpha = .30)
  lowlight.col  <- scales::alpha("#FFD700", alpha = .05)
  default.col   <- c("#9B9B9B", "#FFFFFF")
  slant.col     <- c("#799098", "#BBDDE9")
  
  ui <- fluidPage(
    theme = bslib::bs_theme(
      bootswatch = "lux",
      bg = bg.col,
      fg = "#FFFFFF"
    ),
    
    titlePanel(
      title       = "Rich Picks: Excellence in Film by Year",
      windowTitle = "Rich Picks (Film Awards)"
    ),
    
    mainPanel(
      h6("formerly, 'The SpyGlasses Full'"),
      h6("Author: Rich Truncellito"),
      hr()
    ),
    
    navbarPage(
      "NavBar:",
      
      tabPanel(
        title = "Yearly Awards",
        sidebarLayout(
          sidebarPanel(
            numericInput(
              inputId = "Year_Awards",
              label   = "Film Year",
              value   = 2025,
              min     = 2005,
              max     = 2025,
              step    = 1
            ),
            checkboxInput(
              inputId = "All_Years",
              label   = "All Years",
              value   = FALSE
            ),
            selectInput(
              inputId  = "Category",
              label    = "Category",
              choices  = sort(unique(c$Category)),
              multiple = TRUE
            ),
            checkboxInput(
              inputId = "Winners",
              label   = "Winners Only",
              value   = FALSE
            ),
            hr(),
            gt_output("Reference")
          ),
          mainPanel(
            verbatimTextOutput("Disclaimer"),
            hr(),
            gt_output("Yearly_Awards")
          )
        )
      ),
      
      tabPanel(
        title = "Top 10 Films per Year",
        sidebarLayout(
          sidebarPanel(
            sliderInput(
              inputId = "Year_Best",
              label   = "Film Year",
              value   = 2025,
              min     = 2005,
              max     = 2025,
              step    = 1,
              sep     = ""
            )
          ),
          mainPanel(
            gt_output("Yearly_Best")
          )
        )
      ),
      
      tabPanel(
        title = "Awards Search: By Nominee (Person)",
        sidebarLayout(
          sidebarPanel(
            textInput(
              inputId    = "Nominee",
              label      = "Nominee (Person)",
              value      = "",
              placeholder = "Try 'Meryl Streep' or 'Julianne'"
            ),
            helpText("Start typing a name to see results."),
            hr(),
            gt_output("Reference2")
          ),
          mainPanel(
            gt_output("Search_Results_Nominee")
          )
        )
      ),
      
      tabPanel(
        title = "Awards Search: By Film",
        sidebarLayout(
          sidebarPanel(
            textInput(
              inputId    = "Film",
              label      = "Film",
              placeholder = "Try 'Hidden Figures' or 'Minari'"
            ),
            helpText("Start typing a film title to see results."),
            hr(),
            gt_output("Reference3")
          ),
          mainPanel(
            gt_output("Search_Results_Film")
          )
        )
      )
    )
  )
  
  server <- function(input, output) {
    
    # Legend / reference table (built once per session)
    ref.table <- ref %>%
      gt() %>%
      fmt_image(
        columns = Symbol,
        rows    = contains(match = "_", vars = Symbol),
        path    = "Images",
        file_pattern = "{x}.svg"
      ) %>%
      sub_missing(
        columns      = Symbol,
        missing_text = " "
      ) %>%
      tab_header(
        title    = "Table Legend",
        subtitle = "Context Symbols Explained"
      ) %>%
      tab_options(
        table.font.size        = px(11),
        table.background.color = rgb(1, 1, 0, 0),
        table.font.color       = rgb(1, 1, 1, .8)
      ) %>%
      opt_table_font(font = list(google_font("Work Sans"), "Cochin", "Serif")) %>%
      tab_source_note(
        source_note = "Occasional mistakes may occur. Tint indicates Lead-Supporting incongruity."
      )
    
    output$Reference  <- render_gt({ ref.table })
    output$Reference2 <- render_gt({ ref.table })
    output$Reference3 <- render_gt({ ref.table })
    
    output$Disclaimer <- renderText({
      "Welcome to my site! Enjoy my database of personal film picks since 2005!

Disclaimer (1:00 a.m. Pacific Time, Wednesday, 21 January 2025)

Per annual tradition, here I disclose the only films from the
past cinematic year I have not yet had the chance to finish watching.
Except for only these films (presented in no special order), the
nominations below are final:

- [ ] Song Sung Blue
- [X] The Smashing Machine
- [ ] Sirāt 
- [ ] The Fantastic Four: First Steps
- [ ] Mission Impossible: The Final Reckoning
- [ ] Warfare
- [ ] Sound of Falling
- [ ] The Ugly Stepsister
- [ ] The Lost Bus
- [ ] Kokuho
- [ ] Diane Warren: Relentless
- [ ] Him
- [ ] Christy
- [ ] The Phoenician Scheme
- [ ] Superman
- [ ] Eddington
- [ ] Pillion
- [ ] Arco
- [ ] Demon Slayer: Kimetsu no Yaiba – The Movie: Infinity Castle
- [ ] In Your Dreams
- [ ] Predator: Killer of Killers
- [ ] Little Amélie, or the Character of the Rain
- [ ] Zootopia 2
"
    })
    
    # ─────────────────────────────────────────────────────────
    # Yearly Awards table (uses precomputed yearly_awards_base)
    # ─────────────────────────────────────────────────────────
    
    output$Yearly_Awards <- render_gt({
      dat <- yearly_awards_base %>% mutate(Nominee = case_when(Nominee == "NA" ~ "Nominees TBD", TRUE ~ Nominee))
      
      if (!input$All_Years) {
        dat <- dat %>% filter(Year == input$Year_Awards)
      }
      
      if (length(input$Category)) {
        dat <- dat %>% filter(Category %in% input$Category)
      }
      
      if (input$Winners) {
        dat <- dat %>% filter(Outcome == "Won")
      }
      
      dat %>%
        distinct() %>%
        select(Category, Nominee, Film, Outcome, Context, Year) %>%
        group_by(Category, Year) %>%
        arrange(Category, desc(Year), desc(Outcome), Nominee, .by_group = TRUE) %>%
        gt(rowname_col = "Nominee") %>%
        fmt_image(
          columns      = Context,
          rows         = contains(match = "_", vars = Context),
          path         = "Images",
          file_pattern = "{x}.svg"
        ) %>%
        sub_missing(
          columns      = Context,
          missing_text = " "
        ) %>%
        tab_header(
          title = paste(
            "Rich Picks: ",
            ifelse(
              input$Year_Awards == current.year - 1 & !input$All_Years,
              "Official Nominees ",
              ""
            ),
            ifelse(
              input$Year_Awards == current.year - 2 & !input$All_Years,
              "Official Nominees & Winners ",
              ""
            ),
            ifelse(input$All_Years, "All Years", input$Year_Awards),
            sep = ""
          ),
          subtitle = paste(
            "Arranged by Category",
            ifelse(input$All_Years, " & Year", ""),
            ifelse(input$Year_Awards != current.year, " & Outcome", ""),
            sep = ""
          )
        ) %>%
        tab_options(
          table.font.size        = px(13),
          table.background.color = bg.col
        ) %>%
        opt_row_striping(row_striping = TRUE) %>%
        opt_table_font(font = list(google_font("Work Sans"), "Cochin", "Serif")) %>%
        tab_style(
          style = list(
            cell_text(weight = "bold", color = "white"),
            cell_fill(color = row.head.col, alpha = .90)
          ),
          locations = list(cells_row_groups())
        ) %>%
        tab_style(
          style = list(
            cell_text(weight = "bold"),
            cell_fill(color = "#FFD700", alpha = .25)
          ),
          locations = list(
            cells_body(rows = Outcome == "Won"),
            cells_stub(rows = TRUE)
          )
        ) %>%
        cols_align(
          align   = "center",
          columns = c("Film", "Outcome", "Context")
        )
    })
    
    # ─────────────────────────────────────────────────────────
    # Top 10 films per year (uses precomputed top10_base)
    # ─────────────────────────────────────────────────────────
    
    output$Yearly_Best <- render_gt({
      dat <- top10_base %>%
        filter(Year == input$Year_Best) %>%
        mutate(
          Wins = case_when(
            is.na(Wins) & Year != current.year ~ 0,
            is.na(Wins) & Year == current.year ~ NA_real_,
            TRUE                               ~ Wins
          )
        )
      
      dat <- dat %>%
        arrange(desc(Year), Grade, desc(Wins), desc(Nominations), Film) %>%
        group_by(Year) %>%
        slice_min(order_by = Grade, n = 10, with_ties = FALSE) %>%
        arrange(desc(Year), Grade, desc(Wins), desc(Nominations), Film) %>%
        ungroup()
      
      # Convert Wins to character after ranking
      dat <- dat %>%
        mutate(
          Wins = if_else(
            Year == current.year & is.na(Wins),
            "TBD",
            as.character(Wins)
          )
        )
      
      dat %>%
        gt(rowname_col = "Film") %>%
        tab_header(
          title    = paste("Top 10 Films of the Year: ", input$Year_Best, sep = ""),
          subtitle = "Arranged by Year, Grade, Wins, and Nominations"
        ) %>%
        tab_options(
          table.font.size        = px(13),
          table.background.color = bg.col
        ) %>%
        opt_table_font(font = list(google_font("Work Sans"), "Cochin", "Serif")) %>%
        tab_style(
          style = list(
            cell_text(weight = "bold", color = "white"),
            cell_fill(color = row.head.col, alpha = .90)
          ),
          locations = list(cells_row_groups())
        ) %>%
        data_color(
          columns = "Grade",
          colors  = scales::col_factor(
            palette = c(highlight.col, lowlight.col),
            domain  = levels(d$Grade),
            alpha   = TRUE
          ),
          autocolor_text = FALSE
        )
    })
    
    # ─────────────────────────────────────────────────────────
    # Search by nominee
    # ─────────────────────────────────────────────────────────
    
    output$Search_Results_Nominee <- render_gt({
      req(input$Nominee, input$Nominee != "")
      
      c.bound %>%
        group_by(Nominee) %>%
        filter(str_detect(Nominee, fixed(input$Nominee, ignore_case = TRUE))) %>%
        merge(
          y     = c.bound %>% filter(Outcome == "Won"),
          by    = c("Year", "Category"),
          all.x = TRUE
        ) %>%
        mutate(
          Outcome.x = case_when(
            Outcome.x == "Won" & Outcome.y == "Won" & Film.x != Film.y ~
              paste("Won\nTied with ", Nominee.y, " for '", Film.y, "'", sep = ""),
            Outcome.x == "Lost" & Outcome.y == "Won" ~
              paste("Lost\nto ", Nominee.y, " for '", Film.y, "'", sep = ""),
            TRUE ~ Outcome.x
          )
        ) %>%
        select(Year, Category, Nominee.x, Film.x, Outcome.x, Context.x) %>%
        distinct() %>%
        rename(
          Nominee = Nominee.x,
          Film    = Film.x,
          Outcome = Outcome.x,
          Context = Context.x
        ) %>%
        ungroup() %>%
        group_by(Year, Category, Nominee, Outcome, Context) %>%
        summarise(Film = paste(Film, collapse = " // "), .groups = "drop") %>%
        distinct(Year, Category, Film, Nominee, Context, .keep_all = TRUE) %>%
        relocate(Film, .before = Outcome) %>%
        mutate(Query = paste("Query: ", input$Nominee, sep = "")) %>%
        group_by(Query, Nominee) %>%
        arrange(desc(Year), Category, Film) %>%
        gt(rowname_col = "Year", row_group.sep = " - Nominee: ") %>%
        fmt_image(
          columns      = Context,
          rows         = contains(match = "_", vars = Context),
          path         = "Images",
          file_pattern = "{x}.svg"
        ) %>%
        sub_missing(
          columns      = Context,
          missing_text = " "
        ) %>%
        tab_header(
          title    = "Search Results",
          subtitle = "Grouped by Nominee"
        ) %>%
        tab_options(
          table.font.size        = px(13),
          table.background.color = bg.col
        ) %>%
        opt_table_font(font = list(google_font("Work Sans"), "Cochin", "Serif")) %>%
        tab_style(
          style = list(
            cell_text(weight = "bold", color = "white"),
            cell_fill(color = row.head.col, alpha = .90)
          ),
          locations = list(cells_row_groups())
        ) %>%
        tab_style(
          style = list(
            cell_text(weight = "bold"),
            cell_fill(color = "#FFD700", alpha = .25)
          ),
          locations = list(
            cells_body(rows = grepl("Won", x = Outcome)),
            cells_stub(rows = TRUE)
          )
        ) %>%
        cols_align(
          align   = "center",
          columns = "Context"
        )
    })
    
    # ─────────────────────────────────────────────────────────
    # Search by film
    # ─────────────────────────────────────────────────────────
    
    output$Search_Results_Film <- render_gt({
      req(input$Film, input$Film != "")
      
      c.bound %>%
        group_by(Film) %>%
        filter(str_detect(Film, fixed(input$Film, ignore_case = TRUE))) %>%
        merge(
          y     = c.bound %>% filter(Outcome == "Won"),
          by    = c("Year", "Category"),
          all.x = TRUE
        ) %>%
        mutate(
          Outcome.x = case_when(
            Outcome.x == "Won" & Outcome.y == "Won" & Film.x != Film.y ~
              paste("Won\nTied with ", Nominee.y, " for '", Film.y, "'", sep = ""),
            Outcome.x == "Lost" & Outcome.y == "Won" ~
              paste("Lost\nto ", Nominee.y, " for '", Film.y, "'", sep = ""),
            TRUE ~ Outcome.x
          )
        ) %>%
        select(Year, Category, Nominee.x, Film.x, Outcome.x, Context.x) %>%
        distinct() %>%
        rename(
          Nominee = Nominee.x,
          Film    = Film.x,
          Outcome = Outcome.x,
          Context = Context.x
        ) %>%
        ungroup() %>%
        group_by(Year, Category, Nominee, Outcome, Context) %>%
        summarise(Film = paste(Film, collapse = " // "), .groups = "drop") %>%
        distinct(Year, Category, Film, Nominee, Context, .keep_all = TRUE) %>%
        relocate(Film, .before = Outcome) %>%
        mutate(Query = paste("Query: ", input$Film, sep = "")) %>%
        group_by(Query, Film) %>%
        arrange(desc(Year), Category, Film) %>%
        gt(rowname_col = "Year", row_group.sep = " - Film: ") %>%
        fmt_image(
          columns      = Context,
          rows         = contains(match = "_", vars = Context),
          path         = "Images",
          file_pattern = "{x}.svg"
        ) %>%
        sub_missing(
          columns      = Context,
          missing_text = " "
        ) %>%
        tab_header(
          title    = "Search Results",
          subtitle = "Grouped by Film"
        ) %>%
        tab_options(
          table.font.size        = px(13),
          table.background.color = bg.col
        ) %>%
        opt_table_font(font = list(google_font("Work Sans"), "Cochin", "Serif")) %>%
        tab_style(
          style = list(
            cell_text(weight = "bold", color = "white"),
            cell_fill(color = row.head.col, alpha = .90)
          ),
          locations = list(cells_row_groups())
        ) %>%
        tab_style(
          style = list(
            cell_text(weight = "bold"),
            cell_fill(color = "#FFD700", alpha = .25)
          ),
          locations = list(
            cells_body(rows = grepl("Won", x = Outcome)),
            cells_stub(rows = TRUE)
          )
        ) %>%
        cols_align(
          align   = "center",
          columns = "Context"
        ) %>%
        cols_width(
          "Category" ~ pct(25),
          "Nominee"  ~ pct(25),
          "Outcome"  ~ pct(40),
          "Context"  ~ pct(5)
        )
    })
  }
  
  shinyApp(ui = ui, server = server, ...)
}

myApp()





# #
# # This is a Shiny web application. You can run the application by clicking
# # the 'Run App' button above.
# #
# # Find out more about building applications with Shiny here:
# #
# #    http://shiny.rstudio.com/
# #
# 
# library(dplyr)
# library(shiny)
# library(devtools)
# #library(tidyverse)
# library(stringr)
# library(ggplot2)
# library(gt)
# library(bslib)
# library(scales)
# library(usethis)
# 
# # directory = "~/Documents/R Files/Film"
# # setwd(directory)
# 
# #Run these lines to update the data from the general workspace
# #
# # c <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                sheet = "Nominees", col_names = TRUE, col_types = "c",
# #                                na = c("", "NA"), trim_ws = TRUE) %>% distinct()
# # usethis::use_data(c, overwrite = TRUE)
# # 
# # d <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "Films", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(d, overwrite = TRUE)
# # 
# # e <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                sheet = "Cat_Details", col_names = TRUE, col_types = "c",
# #                                na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(e, overwrite = TRUE)
# # 
# # p <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                sheet = "People", col_names = TRUE, col_types = "c",
# #                                na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(p, overwrite = TRUE)
# 
# # ref <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "Reference", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(ref, overwrite = TRUE)
# # 
# # sag <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "SAG", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(sag, overwrite = TRUE)
# # 
# # pga <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "PGA", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(pga, overwrite = TRUE)
# # 
# # dga <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "DGA", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(dga, overwrite = TRUE)
# # 
# # ves <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "VES", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(ves, overwrite = TRUE)
# # 
# # asc <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "ASC", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# #  usethis::use_data(asc, overwrite = TRUE)
# # 
# # ace <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "ACE", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(ace, overwrite = TRUE)
# # 
# # adg <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "ADG", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(adg, overwrite = TRUE)
# # 
# # cdg <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                 sheet = "CDG", col_names = TRUE, col_types = "c",
# #                 na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(cdg, overwrite = TRUE)
# # 
# # wga <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "WGA", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(wga, overwrite = TRUE)
# # 
# # mpse <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "MPSE", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(mpse, overwrite = TRUE)
# # 
# # cas <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "CAS", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(cas, overwrite = TRUE)
# # 
# # muah <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "MUAH", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(muah, overwrite = TRUE)
# # 
# # scl <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "SCL", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(scl, overwrite = TRUE)
# # 
# # grammy <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "Grammy", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(grammy, overwrite = TRUE)
# # 
# # annie <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                   sheet = "Annie", col_names = TRUE, col_types = "c",
# #                                   na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(annie, overwrite = TRUE)
# # 
# # bafta <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "BAFTA", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(bafta, overwrite = TRUE)
# # 
# # globe <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                  sheet = "Globes", col_names = TRUE, col_types = "c",
# #                                  na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(globe, overwrite = TRUE)
# # 
# # globe.concord <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                            sheet = "Globes_Concordance", col_names = TRUE, col_types = "c",
# #                                            na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(globe.concord, overwrite = TRUE)
# # 
# # oscar <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                    sheet = "Oscars", col_names = TRUE, col_types = "c",
# #                                    na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(oscar, overwrite = TRUE)
# # 
# # oscar.concord <- googlesheets4::read_sheet(ss = "https://docs.google.com/spreadsheets/d/1XwB8nyOMSba8NbNFM9-z6HTHVA10lMz-6GSIqUD0-p4/",
# #                                    sheet = "Oscars' Concordance", col_names = TRUE, col_types = "c",
# #                                    na = c("", "NA"), trim_ws = TRUE)
# # usethis::use_data(oscar.concord, overwrite = TRUE)
# 
# 
# 
# 
# #usethis::use_proprietary_license(copyright_holder = "Rich D. Truncellito, Ph.D.")
# 
# load("data/c.rda")
# load("data/d.rda")
# load("data/e.rda")
# load("data/p.rda")
# load("data/ref.rda")
# load("data/sag.rda")
# load("data/pga.rda")
# load("data/dga.rda")
# load("data/ves.rda")
# load("data/asc.rda")
# load("data/ace.rda")
# load("data/adg.rda")
# load("data/cdg.rda")
# load("data/wga.rda")
# load("data/mpse.rda")
# load("data/cas.rda")
# load("data/muah.rda")
# load("data/scl.rda")
# load("data/grammy.rda")
# load("data/annie.rda")
# load("data/bafta.rda")
# load("data/globe.rda")
# load("data/globe.concord.rda")
# load("data/oscar.rda")
# load("data/oscar.concord.rda")
# 
# sag <- sag %>% mutate(guild = "Screen Actors' Guild", acronym = "SAG")
# pga <- pga %>% mutate(guild = "Producers' Guild of America", acronym = "PGA")
# dga <- dga %>% mutate(guild = "Directors' Guild of America", acronym = "DGA")
# ves <- ves %>% mutate(guild = "Visual Effects' Society", acronym = "VES")
# 
# asc <- asc %>% mutate(guild = "American Society of Cinematographers", acronym = "ASC")
# ace <- ace %>% mutate(guild = "American Cinema Editors", acronym = "ACE")
# adg <- adg %>% mutate(guild = "Art Directors' Guild", acronym = "ADG")
# cdg <- cdg %>% mutate(guild = "Costume Designers' Guild", acronym = "CDG")
# 
# wga <- wga %>% mutate(guild = "Writers' Guild of America", acronym = "WGA")
# mpse <- mpse %>% mutate(guild = "Motion Picture Sound Editors", acronym = "MPSE")
# cas <- cas %>% mutate(guild = "Cinema Audio Society", acronym = "CAS")
# muah <- muah %>% mutate(guild = "Make-Up and Hairstyling", acronym = "MUAH")
# 
# scl <- scl %>% mutate(guild = "Society of Composers & Lyricists", acronym = "SCL")
# 
# 
# guilds <- bind_rows(
#   sag,
#   pga,
#   dga,
#   ves,
#   
#   asc,
#   ace,
#   adg,
#   cdg,
#   
#   wga,
#   mpse,
#   cas,
#   muah,
#   
#   scl
# )
# 
# 
# d <- d %>%
#       mutate(Grade = gsub(pattern = " // ", replacement = "//", x = Grade, fixed = TRUE),
#              Grade = factor(Grade, levels = c("A+", "A+//A",
#                                               "A", "A//A-",
#                                               "A-", "A-//B+",
#                                               "B+", "B+//B",
#                                               "B", "B//B-",
#                                               "B-", "B-//C+",
#                                               "C+", "C+//C",
#                                               "C", "C//C-",
#                                               "C-", "C-//D+",
#                                               "D+", "D+//D",
#                                               "D", "D//D-",
#                                               "D-", "D-//E+",
#                                               "E+", "E+//E",
#                                               "E", "E//E-",
#                                               "E-", "E-//F+",
#                                               "F+", "F+//F",
#                                               "F", "F//F-",
#                                               "F-"
#                                               ),
#                             ordered = TRUE))
# 
# 
# 
# c <-
#   c %>% 
#   mutate(p_id = case_when(is.na(p_id) ~ "p001812", TRUE ~ p_id)) %>%
#   merge(y = p %>% dplyr::select(Nominee, p_id) %>% filter(!is.na(Nominee)), by = "p_id") %>%
#   mutate(Nominee_Lower = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
#          Film_Lower = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#          Title_lower = str_replace_all(tolower(Title), "[[:punct:]]", "")
#                   ) %>%
#   merge(y = guilds %>% filter(acronym != "SAG") %>%
#           filter(Concordance != "Original Song") %>%
#           dplyr::select(c(#"Nominee",
#             "Film",
#             "Year",
#             "Concordance",
#             "Won")) %>%
#           mutate(#Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Year", "Film_Lower", "Category"),
#         by.y = c("Year", "Film", "Concordance"),
#         all.x = TRUE
#         ) %>%
#   
#   merge(y = guilds %>% filter(acronym == "SAG") %>%
#           dplyr::select(c("Nominee",
#                           "Film",
#                           "Year",
#                           "Concordance",
#                           "Won")) %>%
#           mutate(Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
#                  Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#     by.x = c("Year", "Film_Lower", "Category", "Nominee_Lower"),
#     by.y = c("Year", "Film", "Concordance", "Nominee"),
#     all.x = TRUE
#   ) %>%
#   
#   merge(y = e,
#         by = "Category",
#         all.x = TRUE
#   ) %>%
#   
#   mutate(
#     Won = case_when(
#       Division == "Acting" ~ Won.y,
#       TRUE ~ Won.x
#     )
#   ) %>%
#   
#   dplyr::select(!c("Won.x", "Won.y")) %>%
#   
#   
#   merge(y = guilds %>% filter(acronym %in% c("SAG", "WGA"),
#                               !is.na(Concordance)
#                               ) %>%
#           dplyr::select(c("Nominee",
#                           "Film",
#                           "Year",
#                           "Concordance",
#                           "Won")) %>%
#           mutate(Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
#                  Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Year", "Film_Lower", "Nominee_Lower"),
#         by.y = c("Year", "Film", "Nominee"),
#         all.x = TRUE
#   ) %>%
#   
#   mutate(
#     Won = case_when(
#       Division == "Writing" & is.na(Won.x) & !is.na(Won.y) ~ Won.y,
#       Division == "Acting" & is.na(Won.x) & !is.na(Won.y) ~ Won.y,
#       TRUE ~ Won.x
#     ),
#     Concordance = case_when(
#       Division == "Writing" & is.na(Won.x) & !is.na(Won.y) ~ TRUE,
#       Division == "Acting"  & is.na(Won.x) & !is.na(Won.y) ~ TRUE,
#       Division == "Writing" & !is.na(Won.x) ~ FALSE,
#       Division == "Acting"  & !is.na(Won.x) ~ FALSE,
#       TRUE ~ NA
#     )
#   ) %>%
#   
#   dplyr::select(!c("Won.x", "Won.y")) %>%
#   
#   rename(Won_Guild.Slant = Concordance) %>%
#   
#   
#   merge(y = guilds %>% filter(acronym == "SCL" & Concordance == "Original Song") %>%
#           dplyr::select(c("Film", "Concordance", "Won", "Song_Title")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#             Song_Title = str_replace_all(tolower(Song_Title), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Film_Lower", "Category", "Title_lower"),
#         by.y = c("Film", "Concordance", "Song_Title"),
#         all.x = TRUE
#   ) %>%
#   
#   mutate(
#     Won = case_when(
#       Category == "Original Song" ~ Won.y,
#       TRUE ~ Won.x
#     )
#   ) %>%
#   
#   dplyr::select(!c("Won.x", "Won.y")) %>%
#   rename(Won_Guild = Won) %>%
#   
#   
#   merge(y = grammy %>%
#           dplyr::select(c("Film", "Concordance", "Won", "Song")) %>%
#           mutate(
#                  Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#                  Song = str_replace_all(tolower(Song), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Film_Lower", "Category", "Title_lower"),
#         by.y = c("Film", "Concordance", "Song"),
#         all.x = TRUE
#         ) %>%
#   rename(Won_Grammy = Won) %>%
#   
#   merge(y = annie %>%
#           dplyr::select(c("Year", "Film", "Concordance", "Won")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Year", "Film_Lower", "Category"),
#         by.y = c("Year", "Film", "Concordance"),
#         all.x = TRUE
#   ) %>%
#   rename(Won_Annie = Won) %>%
#   
#   merge(y = bafta %>%
#           filter(!str_starts(string = Concordance, pattern = "Act")) %>% 
#           dplyr::select(c("Year", "Film", "Concordance", "Won")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Year", "Film_Lower", "Category"),
#         by.y = c("Year", "Film", "Concordance"),
#         all.x = TRUE
#   ) %>%
#   merge(y = bafta %>%
#           filter(str_starts(string = Concordance, pattern = "Act")) %>% 
#           dplyr::select(c("Year", "Film", "Concordance", "Nominee", "Won")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#             Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Year", "Film_Lower", "Category", "Nominee_Lower"),
#         by.y = c("Year", "Film", "Concordance", "Nominee"),
#         all.x = TRUE
#   ) %>%
#   merge(y = bafta %>%
#           filter(str_starts(string = Concordance, pattern = "Act") |
#                    str_detect(string = Concordance, pattern = "Screenplay")
#                    ) %>% 
#           dplyr::select(c("Year", "Film", "Nominee", "Won")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#             Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", "")
#           ) %>%
#           distinct(),
#         by.x = c("Year", "Film_Lower", "Nominee_Lower"),
#         by.y = c("Year", "Film", "Nominee"),
#         all.x = TRUE
#   ) %>%
#   mutate(
#     Won_BAFTA = case_when(
#       !is.na(Won.x) ~ as.logical(Won.x),
#       !is.na(Won.y) ~ as.logical(Won.y),
#       #This is fine for almost all cases; I think that it leaves in the edge case of the person being slant-nominated for both acting and writing the same film in the saem year. Pretty sure that this has never happened, but it is a flaw technically still
#       Division == "Writing" & !is.na(Won) & is.na(Won.x) ~ as.logical(Won),
#       Division == "Acting" & !is.na(Won) & is.na(Won.y) ~ as.logical(Won),
#       TRUE ~ NA
#     ),
#     Won_BAFTA.Slant = case_when(
#       !is.na(Won.x) ~ NA,
#       !is.na(Won.y) ~ FALSE,
#       Division == "Writing" & !is.na(Won) & is.na(Won.x) ~ TRUE,
#       Division == "Acting" & !is.na(Won) & is.na(Won.y) ~ TRUE,
#       TRUE ~ NA
#     )
#   ) %>%
#   dplyr::select(!c(Won.x, Won.y, Won)) %>%
#   
#   merge(y = globe %>%
#           filter(!str_starts(string = Category_Globes, pattern = "Best Performance"),
#                  !str_starts(string = Category_Globes, pattern = "Best Original Song")) %>%
#           dplyr::select(c("Year", "Film", "Category_Globes", "Win_Globe")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
#           ) %>%
#           distinct() %>%
#           merge(y = globe.concord,
#                 by = "Category_Globes",
#                 all.x = TRUE) %>%
#           dplyr::select(!Category_Globes),
#         by.x = c("Year", "Film_Lower", "Category"),
#         by.y = c("Year", "Film", "Category"),
#         all.x = TRUE
#   ) %>%
#   merge(y = globe %>% filter(str_starts(string = Category_Globes, pattern = "Best Performance") |
#                                str_starts(string = Category_Globes, pattern = "Best Original Song")) %>%
#           dplyr::select(c("Year", "Film", "Category_Globes", "Nominee", "Win_Globe", "Song_Title")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#             Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
#             Song_Title = str_remove_all(string = Song_Title, pattern = stringr::regex("\"|\"")) %>%
#               tolower() %>%
#               str_replace_all("[[:punct:]]", "")
#           ) %>%
#           distinct() %>%
#           merge(y = globe.concord,
#                 by = "Category_Globes",
#                 all.x = TRUE) %>%
#           dplyr::select(!Category_Globes),
#         by.x = c("Year", "Film_Lower", "Category", "Nominee_Lower", "Title_lower"),
#         by.y = c("Year", "Film", "Category", "Nominee", "Song_Title"),
#         all.x = TRUE
#   ) %>%
#   merge(y = globe %>% filter(str_starts(string = Category_Globes, pattern = "Best Performance") ) %>%
#           dplyr::select(c("Year", "Film", "Category_Globes", "Nominee", "Win_Globe")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#             Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", "")
#           ) %>%
#           distinct() %>%
#           merge(y = globe.concord,
#                 by = "Category_Globes",
#                 all.x = TRUE) %>%
#           dplyr::select(!Category_Globes) %>%
#           filter(!is.na(Category)) %>%
#           dplyr::select(!Category),
#         by.x = c("Year", "Film_Lower", "Nominee_Lower"),
#         by.y = c("Year", "Film", "Nominee"),
#         all.x = TRUE
#   ) %>%
#   mutate(
#     Won_Globe = case_when(
#       !is.na(Win_Globe.x) ~ as.logical(Win_Globe.x),
#       !is.na(Win_Globe.y) ~ as.logical(Win_Globe.y),
#       Division == "Acting" & !is.na(Win_Globe) & is.na(Win_Globe.y) ~ as.logical(Win_Globe),
#       TRUE ~ NA
#     ),
#     Won_Globe.Slant = case_when(
#       !is.na(Win_Globe.x) ~ NA,
#       !is.na(Win_Globe.y) ~ FALSE,
#       Division == "Acting" & !is.na(Win_Globe) & is.na(Win_Globe.y) ~ TRUE,
#       TRUE ~ NA
#     )
#   ) %>%
#    dplyr::select(!c(Win_Globe.x, Win_Globe.y, Win_Globe)) %>%
#   
#   merge(y = oscar %>%
#           filter(!str_starts(string = Category_Oscar, pattern = "Act"),
#                  !str_detect(string = Category_Oscar, pattern = "Original Song")) %>%
#           dplyr::select(c("Year", "Film", "Category_Oscar", "Win_Oscar")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", "")
#           ) %>%
#           distinct() %>%
#           merge(y = oscar.concord,
#                 by.x = "Category_Oscar",
#                 by.y = "Oscars",
#                 all.x = TRUE) %>%
#           dplyr::select(!Category_Oscar),
#         by.x = c("Year", "Film_Lower", "Category"),
#         by.y = c("Year", "Film", "Category"),
#         all.x = TRUE
#   ) %>%
#   merge(y = oscar %>% filter(str_starts(string = Category_Oscar, pattern = "Act") |
#                                str_detect(string = Category_Oscar, pattern = "Original Song")) %>%
#           dplyr::select(c("Year", "Film", "Category_Oscar", "Nominee", "Win_Oscar", "Song.Title")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#             Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
#             Song.Title = str_remove_all(string = Song.Title, pattern = stringr::regex("\"|\"")) %>%
#               tolower() %>%
#               str_replace_all("[[:punct:]]", "")
#           ) %>%
#           distinct() %>%
#           merge(y = oscar.concord,
#                 by.x = "Category_Oscar",
#                 by.y = "Oscars",
#                 all.x = TRUE) %>%
#           dplyr::select(!Category_Oscar),
#         by.x = c("Year", "Film_Lower", "Category", "Nominee_Lower", "Title_lower"),
#         by.y = c("Year", "Film", "Category", "Nominee", "Song.Title"),
#         all.x = TRUE
#   ) %>%
#   merge(y = oscar %>% filter(str_starts(string = Category_Oscar, pattern = "Act") |
#                                str_detect(string = Category_Oscar, pattern = "Screenplay")
#                                ) %>%
#           dplyr::select(c("Year", "Film", "Category_Oscar", "Nominee", "Win_Oscar")) %>%
#           mutate(
#             Film = str_replace_all(tolower(Film), "[[:punct:]]", ""),
#             Nominee = str_replace_all(tolower(Nominee), "[[:punct:]]", ""),
#             Division = case_when(
#               str_starts(string = Category_Oscar, pattern = "Act") ~ "Acting",
#               str_detect(string = Category_Oscar, pattern = "Screenplay") ~ "Writing",
#               TRUE ~ NA_character_
#             )
#           ) %>%
#           distinct() %>%
#           merge(y = oscar.concord,
#                 by.x = "Category_Oscar",
#                 by.y = "Oscars",
#                 all.x = TRUE) %>%
#           dplyr::select(!Category_Oscar) %>%
#           filter(!is.na(Category)) %>%
#           dplyr::select(!Category),
#         by.x = c("Year", "Film_Lower", "Nominee_Lower", "Division"),
#         by.y = c("Year", "Film", "Nominee", "Division"),
#         all.x = TRUE
#   ) %>%
#   mutate(
#     Won_Oscar = case_when(
#       !is.na(Win_Oscar.x) ~ as.logical(Win_Oscar.x),
#       !is.na(Win_Oscar.y) ~ as.logical(Win_Oscar.y),
#       #This is fine for almost all cases; I think that it leaves in the edge case of the person being slant-nominated for both acting and writing the same film in the saem year. Pretty sure that this has never happened, but it is a flaw technically still
#       Division == "Writing" & !is.na(Win_Oscar) & is.na(Win_Oscar.x) ~ as.logical(Win_Oscar),
#       Division == "Acting" & !is.na(Win_Oscar) & is.na(Win_Oscar.y) ~ as.logical(Win_Oscar),
#       TRUE ~ NA
#     ),
#     Won_Oscar.Slant = case_when(
#       !is.na(Win_Oscar.x) ~ NA,
#       !is.na(Win_Oscar.y) ~ FALSE,
#       Division == "Writing" & !is.na(Win_Oscar) & is.na(Win_Oscar.x) ~ TRUE,
#       Division == "Acting" & !is.na(Win_Oscar) & is.na(Win_Oscar.y) ~ TRUE,
#       TRUE ~ NA
#     )
#   ) %>%
#   dplyr::select(!c(Win_Oscar.x, Win_Oscar.y, Win_Oscar)) %>%
#   
#   
#   
#   mutate(
#     Nominee = case_when(
#       Category %in% c("Art Direction", "Screenplay (Original)") & !is.na(Role) ~ paste(Nominee, " (", Role, ")", sep = ""),
#       TRUE ~ Nominee
#     ),
#     Role = case_when(
#       Category %in% c("Art Direction", "Screenplay (Original)") ~ NA_character_,
#       TRUE ~ Role
#     )
#   ) %>%
# 
#   
#   
#   group_by(Year, Film_Lower, Category,
#            Nominee_Lower, Film,
#            #Nominee_First, Nominee_Middle, Nominee_Last, Nominee_Appendix,
#            Nominee, Outcome, Nominated,
#           #`Honourable Mention`,
#           Title, #Adapted.Screenplay.Source, Song.Title,
#           Role, #Acting.Role, Contribution,
#           Won_Oscar,
#           Won_Grammy, Won_Annie, Won_BAFTA, Won_Globe) %>%
#   mutate(
#     dupe = n()
#   ) %>%
#   ungroup() %>%
#   filter(!c(dupe > 1 & Won_Guild == FALSE))
# 
# 
# 
# current.year = Sys.Date() %>% as.character() %>% substr(start = 1, stop = 4) %>% as.numeric()
# 
# myApp <- function(...) {
#     
#     
#     bg.col <- "#654F4F"  #"#8C8C8C"
#     row.head.col <- "#573D3D" ##5D5B5B
#     highlight.col <- scales::alpha("#FFD700", alpha = .30)
#     lowlight.col <- scales::alpha("#FFD700", alpha = .05)
#     default.col <- c("#9B9B9B", "#FFFFFF")
#     slant.col <- c("#799098", "#BBDDE9")
#     
#     # Define UI for application that draws a histogram
#     ui <- fluidPage(
#         theme = bslib::bs_theme(bootswatch = "lux",
#                                 bg = bg.col, fg = "#FFFFFF"),
#         
#         # Application title
#         titlePanel(
#             title = "Rich Picks: Excellence in Film by Year",
#             windowTitle = "Rich Picks (Film Awards)"
#         ),
#         
#         mainPanel(
#          # imageOutput("myImage"),
#             h6("formerly, 'The SpyGlasses Full'"),
#             h6("Author: Rich Truncellito"),
#             hr()
#         ),
#         
#         navbarPage("NavBar:",
#                    
#                    tabPanel(
#                        title = "Yearly Awards",
#                        sidebarLayout(
#                            sidebarPanel(
#                                numericInput(inputId = "Year_Awards",
#                                             label = "Film Year",
#                                             value = 2024,
#                                             min = 2005,
#                                             max = 2024,
#                                             step = 1),
#                                checkboxInput(inputId = "All_Years",
#                                              label = "All Years",
#                                              value = FALSE),
#                                selectInput(inputId = "Category",
#                                            label = "Category",
#                                            choices = c$Category %>% unique() %>% sort(),
#                                            multiple = TRUE
#                                            ),
#                                checkboxInput(inputId = "Winners",
#                                              label = "Winners Only",
#                                              value = FALSE),
#                                hr(),
#                                gt_output(outputId = "Reference")
#                            ),
#                            mainPanel(
#                              verbatimTextOutput(outputId = "Disclaimer"),
#                                 hr(),
#                                gt_output(outputId = "Yearly_Awards")
#                            )
#                        ) 
#                    ),
#                    
#                    tabPanel(
#                        title = "Top 10 Films per Year",
#                        sidebarLayout(
#                            sidebarPanel(
#                                numericInput(inputId = "Year_Best",
#                                             label = "Film Year",
#                                             value = 2024,
#                                             min = 2005,
#                                             max = 2024)
#                            ),
#                            mainPanel(
#                                gt_output(outputId = "Yearly_Best")
#                            )
#                        )
#                    ),
#                    tabPanel(
#                        title = "Awards Search: By Nominee (Person)",
#                        sidebarLayout(
#                            sidebarPanel(
#                                textInput(inputId = "Nominee",
#                                          label = "Nominee (Person)",
#                                          value = "",
#                                          placeholder = "Try 'Meryl Streep' or 'Julianne'"),
#                                hr(),
#                                gt_output(outputId = "Reference2")
#                            ),
#                            mainPanel(
#                                gt_output(outputId = "Search_Results_Nominee")
#                            )
#                        )
#                    ),
#                    tabPanel(
#                        title = "Awards Search: By Film",
#                        sidebarLayout(
#                            sidebarPanel(
#                                textInput(inputId = "Film",
#                                          label = "Film",
#                                          #value = "",
#                                          placeholder = "Try 'Hidden Figures' or 'Minari'"),
#                                hr(),
#                                gt_output(outputId = "Reference3")
#                            ),
#                            mainPanel(
#                                gt_output(outputId = "Search_Results_Film")
#                            )
#                        )
#                    )
#         )
#     )
#     
#     # Define server logic required to draw a histogram
#     server <- function(input, output) {
#       
#       # output$myImage <- renderImage({
#       #   list(src = "/Users/richtruncellito/Documents/R Files/Film/Images/award_nom.svg",
#       #        #contentType = 'image/svg',
#       #        width = 400,
#       #        height = 300,
#       #        alt = "This is alternate text")
#       # })
#       
#         
#         c.bound <- c %>%
#           filter(Nominated == "TRUE") %>%
#             select(Year, Film, Category, Nominee,
#                    #age,
#                    Outcome, Won_Oscar, Won_Oscar.Slant,
#                    Won_Guild, Won_Guild.Slant,
#                    Won_Grammy, Won_Annie,
#                    Won_BAFTA, Won_BAFTA.Slant,
#                    Won_Globe, Won_Globe.Slant,
#                    Role, #Acting.Role, Contribution,
#                    Title #Adapted.Screenplay.Source, Song.Title
#                    ) %>%
#             group_by(Year, Film, Category,
#                      #age,
#                      Outcome, Won_Oscar, Won_Oscar.Slant,
#                      Won_Guild, Won_Guild.Slant,
#                      Won_Grammy, Won_Annie,
#                      Won_BAFTA, Won_BAFTA.Slant,
#                      Won_Globe, Won_Globe.Slant,
#                      Role, #Acting.Role, Contribution,
#                      Title #Adapted.Screenplay.Source, Song.Title
#             ) %>%
#             dplyr::summarise(across(c(Nominee), ~ paste(., collapse = ", "))) %>%
#             ungroup() %>%
#             group_by(Year, Nominee, Category, Outcome,
#                      Won_Oscar, Won_Oscar.Slant,
#                      Won_Guild, Won_Guild.Slant,
#                      Won_Grammy, Won_Annie,
#                      Won_BAFTA, Won_BAFTA.Slant,
#                      Won_Globe, Won_Globe.Slant
#                      ) %>%
#             dplyr::summarise(across(c(Film), ~ paste(., collapse = ", "))) %>%
#             ungroup() %>%
#           mutate(
#             Won_Oscar = as.logical(Won_Oscar),
#             Oscar = case_when(
#               # !is.na(Category_Oscar) & Win_Oscar ~ "⬥",
#               # !is.na(Category_Oscar) ~ "⬦",
#               Won_Oscar  & Won_Oscar.Slant  ~ "oscar_won_slant",
#               !Won_Oscar & Won_Oscar.Slant  ~ "oscar_nom_slant",
#               Won_Oscar  ~ "oscar_won",
#               !Won_Oscar ~ "oscar_nom", #Color: #9B9B9B. #9A7979 #B58F8F #8E4949
#               TRUE ~ NA_character_
#             ),
#             Guild = case_when(
#               Won_Guild == TRUE  & Won_Guild.Slant  ~ "award_won_slant",
#               Won_Guild == FALSE & Won_Guild.Slant  ~ "award_nom_slant",
#               Won_Guild == TRUE  ~ "award_won",
#               Won_Guild == FALSE ~ "award_nom",
#               TRUE ~ NA_character_
#             ),
#             BAFTA = case_when(
#               Won_BAFTA == TRUE  & Won_BAFTA.Slant  ~ "bafta_won_slant",
#               Won_BAFTA == FALSE & Won_BAFTA.Slant  ~ "bafta_nom_slant",
#               Won_BAFTA == TRUE  ~ "bafta_won",
#               Won_BAFTA == FALSE ~ "bafta_nom",
#               TRUE ~ NA_character_
#             ),
#             Grammy = case_when(
#               Won_Grammy == TRUE ~ "grammy_won",
#               Won_Grammy == FALSE ~ "grammy_nom",
#               TRUE ~ NA_character_
#             ),
#             Annie = case_when(
#               Won_Annie == TRUE ~ "annie_won",
#               Won_Annie == FALSE ~ "annie_nom",
#               TRUE ~ NA_character_
#             ),
#             Globe = case_when(
#               Won_Globe == TRUE  & Won_Globe.Slant  ~ "globe_won_slant",
#               Won_Globe == FALSE & Won_Globe.Slant  ~ "globe_nom_slant",
#               Won_Globe == TRUE  ~ "globe_won",
#               Won_Globe == FALSE ~ "globe_nom",
#               TRUE ~ NA_character_
#             )
#           ) %>%
#           tidyr::unite(
#             col = "Context",
#             Oscar, #Won_Oscar.Slant,
#             BAFTA, #Won_BAFTA.Slant,
#             Guild, #Won_Guild.Slant,
#             Globe, #Won_Globe.Slant,
#             Annie, Grammy,
#             na.rm = TRUE,
#             sep = ", "
#           ) %>%
#           mutate(
#             Context = case_when(
#               Context == "" ~ NA,
#               TRUE ~ Context
#             )
#           )
#           # mutate(
#           #   Won_Oscar = as.logical(Won_Oscar),
#           #   Oscar = case_when(
#           #     # !is.na(Category_Oscar) & Win_Oscar ~ "⬥",
#           #     # !is.na(Category_Oscar) ~ "⬦",
#           #     Won_Oscar ~ "⬥",
#           #     !Won_Oscar ~ "⬦",
#           #     TRUE ~ ""
#           #   ),
#           #   Guild = case_when(
#           #     Won_Guild == TRUE ~ "★",
#           #     Won_Guild == FALSE ~ "☆",
#           #     TRUE ~ ""
#           #   ),
#           #   BAFTA = case_when(
#           #     Won_BAFTA == TRUE ~ "●",
#           #     Won_BAFTA == FALSE ~ "○",
#           #     TRUE ~ ""
#           #   ),
#           #   Grammy = case_when(
#           #     Won_Grammy == TRUE ~ "■",
#           #     Won_Grammy == FALSE ~ "□",
#           #     TRUE ~ ""
#           #   ),
#           #   Annie = case_when(
#           #     Won_Annie == TRUE ~ "▲",
#           #     Won_Annie == FALSE ~ "△",
#           #     TRUE ~ ""
#           #   ),
#           #   Globe = case_when(
#           #     Won_Globe == TRUE ~ "✦",
#           #     Won_Globe == FALSE ~ "✧",
#           #     TRUE ~ ""
#           #   ),
#           #   Context = paste(Oscar, Guild, BAFTA, Grammy, Annie, Globe,
#           #                   sep = "")
#           # )
#         
#         
#         ref.table <-         ref %>%
#           gt() %>%
#           fmt_image(
#             columns = Symbol,
#             rows = contains(match = "_", vars = Symbol),
#             path = "Images",
#             file_pattern = "{x}.svg"
#           ) %>%
#           sub_missing(
#             columns = Symbol,
#             missing_text = " "
#           ) %>%
#           tab_header(
#             title = paste("Table Legend"),
#             subtitle = "Context Symbols Explained"
#           ) %>%
#           tab_options(
#             table.font.size = px(11),
#             table.background.color = rgb(red = 1, green = 1, blue = 0, alpha = 0),
#             table.font.color = rgb(red = 1, green = 1, blue = 1, alpha = .8)
#           ) %>%
#           opt_table_font(font = list(google_font(name = "Work Sans"), "Cochin", "Serif")) %>%
#           # tab_style(
#           #   style = list(
#           #     cell_text(weight = "bold", color = "white"),
#           #     cell_fill(color = row.head.col, alpha = .90)
#           #   ),
#           #   locations = list(cells_row_groups())
#           # )  %>%
#           tab_source_note(
#             source_note = "Occasional mistakes may occur. Tint indicates Lead-Supporting incongruity."
#           )
#         
#         
#         output$Reference <- render_gt(expr = {ref.table})
#         
#         output$Reference2 <- render_gt(expr = {ref.table})
#         output$Reference3 <- render_gt(expr = {ref.table})
#         
#         
#         output$Disclaimer <- renderText(expr = {"Welcome to my site! Enjoy my database of personal film picks since 2005!
#           
#           Disclaimer (10:00 p.m. Pacific Time, Wednesday, 22 January 2024)
# 
#      Per annual tradition, this disclaimer discloses the only films from the
#      past cinematic year I have not yet had the chance to finish watching. I
#      reserve the right after this date to include any of these films in any
#      category on this page. Other than only these films, the 2024 nominees
#      and winners on this page are final.
# 
# 
#   Outside the Short and Documentary categories (where I have per
#   usual missed more than just a few films), the films I've yet to finish
#   from 2024 are (in no special order):
# 
# - [ ] Moana 2
# - [ ] All We Imagine as Light
# - [ ] The End
# - [ ] Parthenope
# - [ ] The Outrun
# - [ ] Made in England: The Films of Powell and Pressburger
# - [ ] Bird
# - [ ] The Fall Guy
# - [ ] Better Man
# - [ ] Mufasa: The Lion King
# - [ ] Hit Man
# 
# I'll check these films off as I see them. Otherwise, the table below
# represents my final perspective on the 2024 year in film.
# "
#           })
#         
#         
#         #YEARLY AWARDS TABLE------------------
#         output$Yearly_Awards <- render_gt(expr = {
#             c %>%
#                 filter(!is.na(Film) & Nominated == TRUE) %>%
#                 select(Year, Film, Category, Nominee,
#                        #age,
#                        Outcome, Won_Oscar, Won_Oscar.Slant,
#                        Won_Guild, Won_Guild.Slant,
#                        Won_Grammy, Won_Annie,
#                        Won_BAFTA, Won_BAFTA.Slant,
#                        Won_Globe, Won_Globe.Slant,
#                        Role, #Acting.Role, Contribution,
#                        Title #Adapted.Screenplay.Source, Song.Title
#                 ) %>%
#             
#                 group_by(Year, Film, Category,
#                          #age,
#                          Outcome, Won_Oscar, Won_Oscar.Slant,
#                          Won_Guild, Won_Guild.Slant,
#                          Won_Grammy, Won_Annie,
#                          Won_BAFTA, Won_BAFTA.Slant,
#                          Won_Globe, Won_Globe.Slant,
#                          Role, #Acting.Role, Contribution,
#                          Title #Adapted.Screenplay.Source, Song.Title
#                          ) %>%
#                 dplyr::summarise(across(c(Nominee), ~ paste(., collapse = ", "))) %>%
#                 ungroup() %>%
#                 group_by(Year, Film, Category, Nominee,
#                          #age,
#                          Outcome, Title,
#                          Won_Oscar, Won_Oscar.Slant,
#                          Won_Guild, Won_Guild.Slant,
#                          Won_Grammy, Won_Annie,
#                          Won_BAFTA, Won_BAFTA.Slant,
#                          Won_Globe, Won_Globe.Slant,
#                 ) %>%
#                 dplyr::summarise(across(c(Role), ~ paste(., collapse = ", "))) %>%
#                 ungroup() %>%
#             
#             mutate(
#               Nominee = case_when(
#                 str_starts(string = Category, pattern = "Act") ~ paste(Nominee,
#                                                                        "\n",
#                                                                        "as ",
#                                                                        Role,
#                                                                        sep = ""),
#                 Category == "Original Song" ~ paste(Nominee,
#                                                     "\nfor '",
#                                                     Title,
#                                                     "'",
#                                                     sep = ""),
#                 TRUE ~ Nominee
#               ),
#               
#               Film = case_when(
#                 str_detect(string = Category, pattern = "Adapted") ~ paste(Film,
#                                                                            "\n(based on: ",
#                                                                            Title,
#                                                                            ")",
#                                                                            sep = ""
#                 ),
#                 TRUE ~ Film
#               )
#               
#             ) %>%
#             
#                 # group_by(Year, Nominee, Category, Outcome,
#                 #          Category_Oscar, Win_Oscar,
#                 #          Won_Guild, Won_Grammy, Won_Annie, Won_BAFTA, Won_Globe #inserted to accommodate awards references
#                 #          ) %>%
#                 # dplyr::summarise(across(c(Film), ~ paste(., collapse = ", "))) %>%
#                 # ungroup() %>%
#             
#             
#             mutate(
#               Won_Oscar = as.logical(Won_Oscar),
#               Oscar = case_when(
#                 # !is.na(Category_Oscar) & Win_Oscar ~ "⬥",
#                 # !is.na(Category_Oscar) ~ "⬦",
#                 Won_Oscar  & Won_Oscar.Slant  ~ "oscar_won_slant",
#                 !Won_Oscar & Won_Oscar.Slant  ~ "oscar_nom_slant",
#                 Won_Oscar  ~ "oscar_won",
#                 !Won_Oscar ~ "oscar_nom", #Color: #9B9B9B. #9A7979 #B58F8F #8E4949
#                 TRUE ~ NA_character_
#               ),
#               Guild = case_when(
#                 Won_Guild == TRUE  & Won_Guild.Slant  ~ "award_won_slant",
#                 Won_Guild == FALSE & Won_Guild.Slant  ~ "award_nom_slant",
#                 Won_Guild == TRUE  ~ "award_won",
#                 Won_Guild == FALSE ~ "award_nom",
#                 TRUE ~ NA_character_
#               ),
#               BAFTA = case_when(
#                 Won_BAFTA == TRUE  & Won_BAFTA.Slant  ~ "bafta_won_slant",
#                 Won_BAFTA == FALSE & Won_BAFTA.Slant  ~ "bafta_nom_slant",
#                 Won_BAFTA == TRUE  ~ "bafta_won",
#                 Won_BAFTA == FALSE ~ "bafta_nom",
#                 TRUE ~ NA_character_
#               ),
#               Grammy = case_when(
#                 Won_Grammy == TRUE ~ "grammy_won",
#                 Won_Grammy == FALSE ~ "grammy_nom",
#                 TRUE ~ NA_character_
#               ),
#               Annie = case_when(
#                 Won_Annie == TRUE ~ "annie_won",
#                 Won_Annie == FALSE ~ "annie_nom",
#                 TRUE ~ NA_character_
#               ),
#               Globe = case_when(
#                 Won_Globe == TRUE  & Won_Globe.Slant  ~ "globe_won_slant",
#                 Won_Globe == FALSE & Won_Globe.Slant  ~ "globe_nom_slant",
#                 Won_Globe == TRUE  ~ "globe_won",
#                 Won_Globe == FALSE ~ "globe_nom",
#                 TRUE ~ NA_character_
#               )
#             ) %>%
#             tidyr::unite(
#               col = "Context",
#               Oscar, #Won_Oscar.Slant,
#               BAFTA, #Won_BAFTA.Slant,
#               Guild, #Won_Guild.Slant,
#               Globe, #Won_Globe.Slant,
#               Annie, Grammy,
#               na.rm = TRUE,
#               sep = ", "
#             ) %>%
#             mutate(
#               Context = case_when(
#                 Context == "" ~ NA,
#                 TRUE ~ Context
#               )
#             ) %>%
#             #   Context = str_c(Oscar, Guild, BAFTA, Grammy, Annie, Globe, sep = ", ")
#             # ) %>%
#             
#             # mutate(
#             #   Win_Oscar = as.logical(Win_Oscar),
#             #   Nominee = case_when(
#             #     !is.na(Category_Oscar) & Win_Oscar ~ paste(Nominee, "◆", sep = " "),
#             #     !is.na(Category_Oscar) ~ paste(Nominee, "◇", sep = " "),
#             #     TRUE ~ Nominee
#             #   )
#             # ) %>%
#                 
#                 filter ( if (input$All_Years) {Year %in% unique(c$Year)} else { Year == input$Year_Awards} ) %>%
#                 filter ( if (length(input$Category) >= 1) { Category %in% input$Category } else {is.character(Category)}) %>%
#                 filter ( if (input$Winners) { Outcome == "Won" } else {is.character(Outcome) }) %>%
#                 distinct() %>%
#                 #mutate(Query = paste("Query: ", input$Year_Awards, sep = "")) %>%
#                 #select(Year, Category, Nominee, Film, Outcome, Query, Context) %>%
#                 #group_by(Query, Year) %>%
#                 select(Category, Nominee, Film, Outcome, Context, Year) %>%
#                 group_by(Category, Year) %>%
#                 dplyr::arrange(Category, desc(Year), desc(Outcome), Nominee, .by_group = TRUE) %>%
#                 
#                 gt(rowname_col = "Nominee"
#                    # ,
#                    # row_group.sep = " - Film Year: " 
#                    )  %>%
#                 fmt_image(
#                   columns = Context,
#                   rows = contains(match = "_", vars = Context),
#                   path = "Images",
#                   file_pattern = "{x}.svg"
#                 ) %>%
#                 sub_missing(
#                   columns = Context,
#                   missing_text = " "
#                 ) %>%
#                 tab_header(
#                     title = paste("Rich Picks: ",
#                                   ifelse(input$Year_Awards == current.year - 1
#                                          & !input$All_Years, "Official Nominees ", ""),
#                                   ifelse(input$Year_Awards == current.year - 2
#                                          & !input$All_Years, "Official Nominees & Winners ", ""),
#                                   ifelse(input$All_Years, "All Years", input$Year_Awards),
#                                   sep = ""),
#                     subtitle = paste("Arranged by Category",
#                                      ifelse(input$All_Years, " & Year", ""),
#                                      ifelse(input$Year_Awards != current.year, " & Outcome", ""),
#                                      sep = "")
#                 ) %>%
#                 tab_options(
#                     table.font.size = px(13),
#                     table.background.color = bg.col
#                 ) %>%
#               opt_row_striping(row_striping = TRUE) %>%
#                 opt_table_font(font = list(google_font(name = "Work Sans"), "Cochin", "Serif")) %>%
#                 tab_style(
#                     style = list(
#                         cell_text(weight = "bold", color = "white"),
#                         cell_fill(color = row.head.col, alpha = .90)
#                     ),
#                     locations = list(cells_row_groups())
#                 ) %>%
#                 tab_style(
#                     style = list(
#                         cell_text(weight = "bold"),
#                         cell_fill(color = "#FFD700", alpha = .25)
#                     ),
#                     locations = list(
#                         cells_body(rows = {Outcome == "Won"}),
#                         cells_stub(rows = TRUE)
#                     )
#                 ) %>%
#             cols_align(
#               align = "center",
#               columns = c("Film", "Outcome", "Context")
#             )
#         }#,
#         #width = px(650)
#         )
#         
#         output$Yearly_Best <- render_gt(expr = {
#             d %>% select(Year, Film, Grade) %>%
#                 distinct() %>%
#                 filter(Year == input$Year_Best) %>%
#                 merge(y = c %>% filter(Nominated == "TRUE") %>% dplyr::select(c(Year, Film, Category)) %>% distinct() %>% group_by(Year, Film) %>% dplyr::count() %>% ungroup() %>% as.data.frame(),
#                       by = c("Year", "Film"),
#                       all.x = TRUE) %>%
#                 dplyr::rename(Nominations = n) %>%
#                 merge(y = c %>% filter(Nominated == "TRUE") %>% dplyr::select(c(Year, Film, Category, Outcome)) %>% filter(Outcome == "Won") %>% group_by(Year, Film, Category) %>% dplyr::count() %>% ungroup() %>% group_by(Year, Film) %>% dplyr::count() %>% ungroup() %>% as.data.frame(),
#                       by = c("Year", "Film"),
#                       all.x = TRUE) %>%
#                 dplyr::rename(Wins = n) %>%
#                 mutate(Wins = ifelse(is.na(Wins) & Year != current.year, 0,
#                                      ifelse(is.na(Wins) & Year == current.year, "TBD", Wins))) %>%
#                 arrange(desc(Year), Grade, desc(Wins), desc(Nominations), Film) %>%
#                 group_by(Year) %>%
#                 slice_min(order_by = Grade, n = 10, with_ties = FALSE) %>%
#                 arrange(desc(Year), Grade, desc(Wins), desc(Nominations), Film) %>%
#                 
#                 gt(rowname_col = "Film") %>%
#                 tab_header(
#                     title = paste("Top 10 Films of the Year: ", input$Year_Best, sep = ""),
#                     subtitle = "Arranged by Year, Grade, Wins, and Nominations"
#                 ) %>%
#                 tab_options(
#                     table.font.size = px(13),
#                     table.background.color = bg.col
#                 ) %>%
#                 opt_table_font(font = list(google_font(name = "Work Sans"), "Cochin", "Serif")) %>%
#                 tab_style(
#                     style = list(
#                         cell_text(weight = "bold", color = "white"),
#                         cell_fill(color = row.head.col, alpha = .90)
#                     ),
#                     locations = list(cells_row_groups())
#                 ) %>%
#                 data_color(
#                     columns = "Grade",
#                     colors = scales::col_factor(
#                         palette = c(highlight.col, lowlight.col),
#                         domain = d$Grade %>% levels(),
#                         alpha = TRUE
#                     ),
#                     autocolor_text = FALSE
#                 )
#         },
#         width = px(650)
#         )
#         
#         
#         
#         
#         output$Search_Results_Nominee <-# ifelse(input$Film == "", yes = "", no = 
#             render_gt(expr = {
#                 c.bound %>%
#                     
#                     group_by(Nominee) %>%
#                     filter(str_detect(Nominee, fixed(input$Nominee, ignore_case = TRUE))) %>%
#                     merge(y = c.bound %>% filter(Outcome == "Won"),
#                           by = c("Year", "Category"),
#                           all.x = TRUE) %>%
#                 #filter(Film.x != Film.y) %>%
#                     mutate(Outcome.x = case_when(
#                         Outcome.x == "Won" & Outcome.y == "Won" & Film.x != Film.y ~ paste("Won\nTied with ", Nominee.y, " for '", Film.y, "'", sep = ""),
#                         Outcome.x == "Lost" & Outcome.y == "Won" ~ paste("Lost\nto ", Nominee.y, " for '", Film.y, "'", sep = ""),
#                         TRUE ~ Outcome.x
#                     )) %>%
#                     select(Year, Category, Nominee.x, Film.x, Outcome.x, Context.x) %>% distinct() %>%
#                     dplyr::rename(Nominee = Nominee.x,
#                                   Film = Film.x,
#                                   Outcome = Outcome.x,
#                                   Context = Context.x) %>%
#                     ungroup() %>%
#                     group_by(Year, Category, Nominee, Outcome, Context) %>%
#                     dplyr::summarise(Film = paste(Film, collapse = " // ")) %>%
#                     ungroup() %>%
#                 
#                 distinct(Year, Category, Film, Nominee, Context, .keep_all = TRUE) %>%
# 
#                     relocate(Film, .before = Outcome) %>%
#                     mutate(Query = paste("Query: ", input$Nominee, sep = "")) %>%
#                     group_by(Query, Nominee) %>%
#                     arrange(desc(Year), Category, Film) %>%
#                     
#                     
#                     
#                     gt(rowname_col = "Year",
#                        row_group.sep = " - Nominee: " ) %>%
#                     fmt_image(
#                       columns = Context,
#                       rows = contains(match = "_", vars = Context),
#                       path = "Images",
#                       file_pattern = "{x}.svg"
#                     ) %>%
#                     sub_missing(
#                       columns = Context,
#                       missing_text = " "
#                     ) %>%
#                     tab_header(
#                         title = "Search Results",
#                         subtitle = "Grouped by Nominee"
#                     ) %>%
#                     tab_options(
#                         table.font.size = px(13),
#                         table.background.color = bg.col
#                     ) %>%
#                     opt_table_font(font = list(google_font(name = "Work Sans"), "Cochin", "Serif")) %>%
#                     tab_style(
#                         style = list(
#                             cell_text(weight = "bold", color = "white"),
#                             cell_fill(color = row.head.col, alpha = .90)
#                         ),
#                         locations = list(cells_row_groups())
#                     ) %>%
#                     tab_style(
#                         style = list(
#                             cell_text(weight = "bold"),
#                             cell_fill(color = "#FFD700", alpha = .25)
#                         ),
#                         locations = list(
#                             cells_body(rows = {grepl("Won", x = Outcome)}),
#                             cells_stub(rows = TRUE)
#                         )
#                     ) %>%
#                 cols_align(
#                   align = "center",
#                   columns = "Context"
#                 )
#                 
#             }#,
#             #width = px(650)
#             )
#         # )
#         
#         output$Search_Results_Film <-# ifelse(input$Film == "", yes = "", no = 
#             render_gt(expr = {
#                 c.bound %>%
#                     
#                     group_by(Film) %>%
#                     filter(str_detect(Film, fixed(input$Film, ignore_case = TRUE))) %>%
#                     merge(y = c.bound %>% filter(Outcome == "Won"),
#                           by = c("Year", "Category"),
#                           all.x = TRUE) %>%
#                 #filter(Film.x != Film.y) %>%    
#                 
#                     mutate(Outcome.x = case_when(
#                         Outcome.x == "Won" & Outcome.y == "Won" & Film.x != Film.y ~ paste("Won\nTied with ", Nominee.y, " for '", Film.y, "'", sep = ""),
#                         Outcome.x == "Lost" & Outcome.y == "Won" ~ paste("Lost\nto ", Nominee.y, " for '", Film.y, "'", sep = ""),
#                         TRUE ~ Outcome.x
#                     )) %>%
#                     select(Year, Category, Nominee.x, Film.x, Outcome.x, Context.x) %>% distinct() %>%
#                     dplyr::rename(Nominee = Nominee.x,
#                                   Film = Film.x,
#                                   Outcome = Outcome.x,
#                                   Context = Context.x) %>%
#                     ungroup() %>%
#                     group_by(Year, Category, Nominee, Outcome, Context) %>%
#                     dplyr::summarise(Film = paste(Film, collapse = " // ")) %>% ungroup() %>%
#                 
#                 distinct(Year, Category, Film, Nominee, Context, .keep_all = TRUE) %>%
#                 
#                     relocate(Film, .before = Outcome) %>%
#                     mutate(Query = paste("Query: ", input$Film, sep = "")) %>%
#                     group_by(Query, Film) %>%
#                     arrange(desc(Year), Category, Film) %>%
#                     
#                     
#                     
#                     gt(rowname_col = "Year",
#                        row_group.sep = " - Film: " ) %>%
#                     fmt_image(
#                       columns = Context,
#                       rows = contains(match = "_", vars = Context),
#                       path = "Images",
#                       file_pattern = "{x}.svg"
#                     ) %>%
#                     sub_missing(
#                       columns = Context,
#                       missing_text = " "
#                     ) %>%
#                     tab_header(
#                         title = "Search Results",
#                         subtitle = "Grouped by Film"
#                     ) %>%
#                     tab_options(
#                         table.font.size = px(13),
#                         table.background.color = bg.col
#                     ) %>%
#                     opt_table_font(font = list(google_font(name = "Work Sans"), "Cochin", "Serif")) %>%
#                     tab_style(
#                         style = list(
#                             cell_text(weight = "bold", color = "white"),
#                             cell_fill(color = row.head.col, alpha = .90)
#                         ),
#                         locations = list(cells_row_groups())
#                     ) %>%
#                     tab_style(
#                         style = list(
#                             cell_text(weight = "bold"),
#                             cell_fill(color = "#FFD700", alpha = .25)
#                         ),
#                         locations = list(
#                             cells_body(rows = {grepl("Won", x = Outcome)}),
#                             cells_stub(rows = TRUE)
#                         )
#                     ) %>%
#                 cols_align(
#                   align = "center",
#                   columns = "Context"
#                 ) %>%
#                 cols_width(
#                   "Category" ~ pct(25),
#                   "Nominee" ~ pct(25),
#                   "Outcome" ~ pct (40),
#                   "Context" ~ pct(5)
#                 )
#                 
#             }#,
#             #width = px(650)
#             )
#         # )
#         
#     }
#     
#     # Run the application 
#     shinyApp(ui = ui, server = server, ...) #%>% run_with_themer()
#     
# }
# 
# myApp()
