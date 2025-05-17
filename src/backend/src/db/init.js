const db = require('../db');

async function initDatabase() {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Überprüfe und erstelle group_watchlists Tabelle
        await client.query(`
            CREATE TABLE IF NOT EXISTS group_watchlists (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('group_watchlists Tabelle überprüft/erstellt');

        // Überprüfe und erstelle group_members Tabelle
        await client.query(`
            CREATE TABLE IF NOT EXISTS group_members (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES group_watchlists(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(group_id, user_id)
            )
        `);
        console.log('group_members Tabelle überprüft/erstellt');

        // Überprüfe status Spalte
        const statusColumnCheck = await client.query(`
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'group_members' AND column_name = 'status'
        `);

        if (statusColumnCheck.rows.length === 0) {
            await client.query(`
                ALTER TABLE group_members 
                ADD COLUMN status VARCHAR(50) DEFAULT 'pending'
            `);
            await client.query(`
                UPDATE group_members SET status = 'accepted'
            `);
            console.log('status Spalte hinzugefügt und initialisiert');
        }

        // Überprüfe created_at Spalte
        const createdAtColumnCheck = await client.query(`
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'group_members' AND column_name = 'created_at'
        `);

        if (createdAtColumnCheck.rows.length === 0) {
            await client.query(`
                ALTER TABLE group_members 
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            console.log('created_at Spalte hinzugefügt');
        }

        await client.query('COMMIT');
        console.log('Datenbankinitialisierung erfolgreich abgeschlossen');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fehler bei der Datenbankinitialisierung:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Führe die Initialisierung aus
initDatabase().catch(console.error);

module.exports = { initDatabase }; 