-- Füge status und created_at-Spalten zur group_members Tabelle hinzu
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'accepted';
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Aktualisiere bestehende Einträge
UPDATE group_members SET status = 'accepted' WHERE status IS NULL;
UPDATE group_members SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

-- Füge updated_at Spalte zur movies Tabelle hinzu
ALTER TABLE movies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Erstelle oder aktualisiere den Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_movies_updated_at ON movies;
CREATE TRIGGER update_movies_updated_at
    BEFORE UPDATE ON movies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 