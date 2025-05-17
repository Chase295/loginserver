-- Users-Tabelle
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    watchlist_visibility VARCHAR(50) DEFAULT 'public',
    is_active BOOLEAN DEFAULT true
);

-- Movies-Tabelle
CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    original_title VARCHAR(255),
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),
    overview TEXT,
    release_date DATE,
    vote_average DECIMAL(3,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Watchlist-Verbindungstabelle
CREATE TABLE IF NOT EXISTS user_watchlist (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'watchlist',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, movie_id)
);

-- Gruppen-Watchlist-Tabelle
CREATE TABLE IF NOT EXISTS group_watchlists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gruppen-Mitglieder-Tabelle
CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER REFERENCES group_watchlists(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

-- Gruppen-Filme-Tabelle
CREATE TABLE IF NOT EXISTS group_movies (
    group_id INTEGER REFERENCES group_watchlists(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, movie_id)
); 