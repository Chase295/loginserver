-- Überprüfe ob die Tabellen existieren und erstelle sie wenn nötig
DO $$ 
BEGIN
    -- users Tabelle
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

    -- group_watchlists Tabelle
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_watchlists') THEN
        CREATE TABLE group_watchlists (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Index für creator_id
        CREATE INDEX idx_group_watchlists_creator_id ON group_watchlists(creator_id);
    END IF;

    -- group_members Tabelle
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_members') THEN
        CREATE TABLE group_members (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES group_watchlists(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, user_id)
        );
        
        -- Indizes für schnellere Abfragen
        CREATE INDEX idx_group_members_group_id ON group_members(group_id);
        CREATE INDEX idx_group_members_user_id ON group_members(user_id);
        CREATE INDEX idx_group_members_status ON group_members(status);
    END IF;

    -- Überprüfe ob die status Spalte existiert
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'group_members' AND column_name = 'status'
    ) THEN
        ALTER TABLE group_members ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
        -- Setze existierende Einträge auf 'accepted'
        UPDATE group_members SET status = 'accepted';
    END IF;

    -- Überprüfe ob die created_at Spalte existiert
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'group_members' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE group_members ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Überprüfe ob die Indizes existieren
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_group_watchlists_creator_id') THEN
        CREATE INDEX idx_group_watchlists_creator_id ON group_watchlists(creator_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_group_members_group_id') THEN
        CREATE INDEX idx_group_members_group_id ON group_members(group_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_group_members_user_id') THEN
        CREATE INDEX idx_group_members_user_id ON group_members(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_group_members_status') THEN
        CREATE INDEX idx_group_members_status ON group_members(status);
    END IF;

    -- Überprüfe und repariere inkonsistente Daten
    -- Stelle sicher, dass alle Gruppen-Ersteller auch Mitglieder sind
    INSERT INTO group_members (group_id, user_id, status, created_at)
    SELECT gw.id, gw.creator_id, 'accepted', gw.created_at
    FROM group_watchlists gw
    LEFT JOIN group_members gm ON gw.id = gm.group_id AND gw.creator_id = gm.user_id
    WHERE gm.id IS NULL;

    -- Setze den Status aller Gruppen-Ersteller auf 'accepted'
    UPDATE group_members gm
    SET status = 'accepted'
    FROM group_watchlists gw
    WHERE gm.group_id = gw.id AND gm.user_id = gw.creator_id AND gm.status != 'accepted';

END $$; 