const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db');

// Debug-Logging für alle Routen
router.use((req, res, next) => {
    console.log(`[GroupWatchlist] ${req.method} ${req.originalUrl}`);
    next();
});

// Gruppe erstellen
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;

        console.log(`Creating group "${name}" for user ${userId}`);

        // Erstelle die Gruppe in einer Transaktion
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Erstelle die Gruppe
            const groupResult = await client.query(
                'INSERT INTO group_watchlists (name, creator_id) VALUES ($1, $2) RETURNING *',
                [name, userId]
            );

            const groupId = groupResult.rows[0].id;
            console.log(`Created group with ID ${groupId}`);

            // Füge den Creator als Mitglied hinzu
            await client.query(
                'INSERT INTO group_members (group_id, user_id, status, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
                [groupId, userId, 'accepted']
            );

            await client.query('COMMIT');
            console.log(`Successfully created group ${groupId} with creator as member`);
            res.json(groupResult.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Fehler beim Erstellen der Gruppe:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Mitgliedschaftsstatus prüfen
router.get('/:groupId/membership-status', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    console.log(`[GroupWatchlist] Starting membership status check`);
    
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        console.log(`[GroupWatchlist] Checking membership status - Group: ${groupId}, User: ${userId}`);

        // Prüfe in einer Transaktion
        await client.query('BEGIN');

        // Prüfe zuerst, ob die Gruppe überhaupt existiert
        const groupExists = await client.query(
            'SELECT EXISTS(SELECT 1 FROM group_watchlists WHERE id = $1)',
            [groupId]
        );

        if (!groupExists.rows[0].exists) {
            console.log(`[GroupWatchlist] Group ${groupId} does not exist`);
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                error: 'Gruppe nicht gefunden',
                details: 'Die angegebene Gruppe existiert nicht in der Datenbank.'
            });
        }

        // Hole Gruppeninformationen
        const groupInfo = await client.query(
            'SELECT creator_id FROM group_watchlists WHERE id = $1',
            [groupId]
        );

        // Wenn User der Creator ist
        if (groupInfo.rows[0].creator_id === userId) {
            console.log(`[GroupWatchlist] User ${userId} is creator of group ${groupId}`);
            
            // Stelle sicher, dass der Creator als Mitglied existiert
            const memberExists = await client.query(
                'SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2)',
                [groupId, userId]
            );

            if (!memberExists.rows[0].exists) {
                console.log(`[GroupWatchlist] Creating missing member entry for creator`);
                // Füge Creator als Mitglied hinzu
                await client.query(
                    'INSERT INTO group_members (group_id, user_id, status, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
                    [groupId, userId, 'accepted']
                );
            }

            await client.query('COMMIT');
            return res.json({ status: 'accepted', isCreator: true });
        }

        // Prüfe den Mitgliedschaftsstatus für normale Mitglieder
        const memberStatus = await client.query(
            'SELECT status FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, userId]
        );

        console.log('[GroupWatchlist] Member status result:', memberStatus.rows);

        if (memberStatus.rows.length === 0) {
            console.log(`[GroupWatchlist] User ${userId} is not a member of group ${groupId}`);
            await client.query('COMMIT');
            return res.json({ status: 'not_member' });
        }

        await client.query('COMMIT');
        return res.json({ 
            status: memberStatus.rows[0].status,
            isCreator: false
        });

    } catch (error) {
        console.error('[GroupWatchlist] Error checking membership status:', error);
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[GroupWatchlist] Error during rollback:', rollbackError);
        }
        res.status(500).json({ 
            error: 'Interner Serverfehler',
            details: error.message
        });
    } finally {
        client.release();
    }
});

// Alle Gruppen eines Users abrufen
router.get('/', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const userId = req.user.id;
        console.log(`[GroupWatchlist] Fetching groups for user ${userId}`);

        // Hole alle Gruppen (sowohl akzeptierte als auch ausstehende)
        const result = await client.query(
            `SELECT 
                gw.*,
                u.username as creator_username,
                gm.status as membership_status
             FROM group_watchlists gw
             JOIN group_members gm ON gw.id = gm.group_id
             JOIN users u ON gw.creator_id = u.id
             WHERE gm.user_id = $1
             ORDER BY gw.created_at DESC`,
            [userId]
        );

        // Gruppiere die Ergebnisse nach Status
        const groups = {
            accepted: [],
            pending: []
        };

        result.rows.forEach(row => {
            if (row.membership_status === 'accepted') {
                groups.accepted.push(row);
            } else if (row.membership_status === 'pending') {
                groups.pending.push(row);
            }
        });

        console.log(`[GroupWatchlist] Found ${groups.accepted.length} accepted and ${groups.pending.length} pending groups`);
        res.json(groups);
    } catch (error) {
        console.error('[GroupWatchlist] Error fetching groups:', error);
        res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
    } finally {
        client.release();
    }
});

// Einzelne Gruppe abrufen
router.get('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            `SELECT gw.*, u.username as creator_username 
             FROM group_watchlists gw
             JOIN users u ON gw.creator_id = u.id
             WHERE gw.id = $1`,
            [groupId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Gruppe nicht gefunden' });
        }

        // Prüfen ob User Mitglied ist
        const memberCheck = await db.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Fehler beim Abrufen der Gruppe:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Gruppe aktualisieren
router.put('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name } = req.body;
        const userId = req.user.id;

        // Prüfen ob User Creator ist
        const creatorCheck = await db.query(
            'SELECT 1 FROM group_watchlists WHERE id = $1 AND creator_id = $2',
            [groupId, userId]
        );

        if (creatorCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Nur der Ersteller kann die Gruppe bearbeiten' });
        }

        const result = await db.query(
            'UPDATE group_watchlists SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [name, groupId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Gruppe:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Gruppe löschen
router.delete('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        // Prüfen ob User Creator ist
        const creatorCheck = await db.query(
            'SELECT 1 FROM group_watchlists WHERE id = $1 AND creator_id = $2',
            [groupId, userId]
        );

        if (creatorCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Nur der Ersteller kann die Gruppe löschen' });
        }

        await db.query('DELETE FROM group_watchlists WHERE id = $1', [groupId]);
        res.json({ message: 'Gruppe erfolgreich gelöscht' });
    } catch (error) {
        console.error('Fehler beim Löschen der Gruppe:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Gruppenmitglieder abrufen
router.get('/:groupId/members', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        // Prüfen ob User Mitglied ist
        const memberCheck = await db.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = $3',
            [groupId, userId, 'accepted']
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
        }

        const result = await db.query(
            `SELECT DISTINCT u.id, u.username, u.email, gm.status
             FROM users u
             JOIN group_members gm ON u.id = gm.user_id
             WHERE gm.group_id = $1 AND gm.status = 'accepted'
             ORDER BY u.username`,
            [groupId]
        );

        console.log(`[GroupWatchlist] Found ${result.rows.length} accepted members for group ${groupId}`);
        res.json(result.rows);
    } catch (error) {
        console.error('Fehler beim Abrufen der Gruppenmitglieder:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Mitglied hinzufügen
router.post('/:groupId/members', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { groupId } = req.params;
        const { username } = req.body;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Prüfen ob User Creator ist
        const creatorCheck = await client.query(
            'SELECT 1 FROM group_watchlists WHERE id = $1 AND creator_id = $2',
            [groupId, userId]
        );

        if (creatorCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Nur der Ersteller kann Mitglieder hinzufügen' });
        }

        // User-ID anhand des Benutzernamens finden
        const userResult = await client.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const newUserId = userResult.rows[0].id;

        // Prüfen ob User bereits Mitglied oder eingeladen ist
        const memberCheck = await client.query(
            'SELECT gm.id, gm.status FROM group_members gm WHERE gm.group_id = $1 AND gm.user_id = $2',
            [groupId, newUserId]
        );

        console.log(`[GroupWatchlist] Member check for user ${username}:`, memberCheck.rows);

        if (memberCheck.rows.length > 0) {
            const status = memberCheck.rows[0].status;
            if (status === 'accepted') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Benutzer ist bereits Mitglied' });
            } else if (status === 'pending') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Benutzer wurde bereits eingeladen' });
            }
        }

        // Einladung erstellen
        await client.query(
            'INSERT INTO group_members (group_id, user_id, status, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
            [groupId, newUserId, 'pending']
        );

        await client.query('COMMIT');
        res.json({ message: 'Einladung erfolgreich gesendet' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[GroupWatchlist] Error adding member:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    } finally {
        client.release();
    }
});

// Einladung annehmen oder ablehnen
router.post('/:groupId/invites/:action', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    console.log(`[GroupWatchlist] Processing invite ${req.params.action} for group ${req.params.groupId}`);
    
    try {
        const { groupId, action } = req.params;
        const userId = req.user.id;

        if (action !== 'accept' && action !== 'reject') {
            console.log(`[GroupWatchlist] Invalid action: ${action}`);
            return res.status(400).json({ error: 'Ungültige Aktion' });
        }

        await client.query('BEGIN');

        // Prüfen ob Einladung existiert
        const inviteCheck = await client.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = $3',
            [groupId, userId, 'pending']
        );

        console.log(`[GroupWatchlist] Invite check result:`, inviteCheck.rows);

        if (inviteCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Keine ausstehende Einladung gefunden' });
        }

        if (action === 'accept') {
            // Einladung annehmen
            await client.query(
                'UPDATE group_members SET status = $1 WHERE group_id = $2 AND user_id = $3',
                ['accepted', groupId, userId]
            );
            console.log(`[GroupWatchlist] Invite accepted for user ${userId} in group ${groupId}`);
            await client.query('COMMIT');
            res.json({ message: 'Einladung erfolgreich angenommen' });
        } else {
            // Einladung ablehnen
            await client.query(
                'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
                [groupId, userId]
            );
            console.log(`[GroupWatchlist] Invite rejected for user ${userId} in group ${groupId}`);
            await client.query('COMMIT');
            res.json({ message: 'Einladung erfolgreich abgelehnt' });
        }
    } catch (error) {
        console.error('[GroupWatchlist] Error processing invite:', error);
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
    } finally {
        client.release();
    }
});

// Mitglied entfernen
router.delete('/:groupId/members/:memberId', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { groupId, memberId } = req.params;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Prüfe ob User Creator ist
        const creatorCheck = await client.query(
            'SELECT 1 FROM group_watchlists WHERE id = $1 AND creator_id = $2',
            [groupId, userId]
        );

        if (creatorCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Nur der Ersteller kann Mitglieder entfernen' });
        }

        // Prüfe ob das zu entfernende Mitglied der Creator ist
        const isCreator = await client.query(
            'SELECT 1 FROM group_watchlists WHERE id = $1 AND creator_id = $2',
            [groupId, memberId]
        );

        if (isCreator.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Der Ersteller kann nicht entfernt werden' });
        }

        // Entferne das Mitglied
        const result = await client.query(
            'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING *',
            [groupId, memberId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Mitglied nicht gefunden' });
        }

        await client.query('COMMIT');
        console.log(`[GroupWatchlist] Successfully removed member ${memberId} from group ${groupId}`);
        res.json({ message: 'Mitglied erfolgreich entfernt' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[GroupWatchlist] Error removing member:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    } finally {
        client.release();
    }
});

// Filme der Gruppe abrufen
router.get('/:groupId/movies', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Prüfen ob User Mitglied ist
        const memberCheck = await client.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = $3',
            [groupId, userId, 'accepted']
        );

        if (memberCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
        }

        const result = await client.query(
            `SELECT * FROM movies 
             WHERE group_id = $1 
             ORDER BY created_at DESC`,
            [groupId]
        );

        await client.query('COMMIT');
        res.json(result.rows);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Abrufen der Gruppenfilme:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    } finally {
        client.release();
    }
});

// Film zu Gruppen-Watchlist hinzufügen
router.post('/:groupId/movies', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const groupId = req.params.groupId;
        const userId = req.user.id;
        const movieData = req.body;

        console.log('Empfangene Film-Daten:', {
            ...movieData,
            rating: movieData.rating,
            ratingType: typeof movieData.rating
        });

        await client.query('BEGIN');

        // Prüfen ob User Mitglied der Gruppe ist
        const memberCheck = await client.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = $3',
            [groupId, userId, 'accepted']
        );

        if (memberCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
        }

        // Prüfen ob der Film bereits in der Gruppe existiert
        const existingMovie = await client.query(
            'SELECT 1 FROM movies WHERE group_id = $1 AND tmdb_id = $2 AND media_type = $3',
            [groupId, movieData.tmdb_id, movieData.media_type]
        );

        if (existingMovie.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Film bereits in der Gruppen-Watchlist vorhanden' });
        }

        // Film zur Gruppe hinzufügen
        const result = await client.query(
            `INSERT INTO movies (
                group_id, title, year, poster_url, tmdb_id, media_type, 
                backdrop_path, overview, vote_average, genres, status, 
                abbruch_grund, rating, notes, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
            RETURNING *`,
            [
                groupId,
                movieData.title,
                movieData.year,
                movieData.poster_url,
                movieData.tmdb_id,
                movieData.media_type,
                movieData.backdrop_path,
                movieData.overview,
                movieData.vote_average,
                JSON.stringify(movieData.genres || []),
                movieData.status || 'watchlist',
                movieData.abbruch_grund,
                movieData.rating !== undefined ? Number(movieData.rating) : 0,  // Explizite Konvertierung zu Number
                movieData.notes || '',
                JSON.stringify(movieData.tags || [])
            ]
        );

        console.log('Film erfolgreich hinzugefügt:', result.rows[0]);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Hinzufügen des Films:', err);
        res.status(500).json({ error: 'Interner Serverfehler' });
    } finally {
        client.release();
    }
});

// Film in Gruppen-Watchlist aktualisieren
router.put('/:groupId/movies/:movieId', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { groupId, movieId } = req.params;
        const userId = req.user.id;
        const movieData = req.body;

        console.log('Update-Request für Film erhalten:', {
            groupId,
            movieId,
            userId,
            movieData
        });

        await client.query('BEGIN');

        // Prüfen ob User Mitglied der Gruppe ist
        const memberCheck = await client.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = $3',
            [groupId, userId, 'accepted']
        );

        if (memberCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
        }

        // Film aktualisieren
        const result = await client.query(
            `UPDATE movies SET
                status = $1,
                rating = $2,
                notes = $3,
                abbruch_grund = $4,
                tags = $5
            WHERE id = $6 AND group_id = $7
            RETURNING *`,
            [
                movieData.status || 'watchlist',
                movieData.rating || 0,
                movieData.notes || '',
                movieData.abbruch_grund,
                JSON.stringify(movieData.tags || []),
                movieId,
                groupId
            ]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Film nicht gefunden' });
        }

        console.log('Film erfolgreich aktualisiert:', result.rows[0]);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Aktualisieren des Films:', err);
        res.status(500).json({ 
            error: 'Interner Serverfehler',
            details: err.message
        });
    } finally {
        client.release();
    }
});

// Film aus Gruppe entfernen
router.delete('/:groupId/movies/:movieId', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { groupId, movieId } = req.params;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Prüfen ob User Mitglied ist
        const memberCheck = await client.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = $3',
            [groupId, userId, 'accepted']
        );

        if (memberCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
        }

        // Film löschen
        await client.query(
            'DELETE FROM movies WHERE id = $1 AND group_id = $2',
            [movieId, groupId]
        );

        await client.query('COMMIT');
        res.json({ message: 'Film erfolgreich aus der Gruppen-Watchlist entfernt' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Entfernen des Films:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    } finally {
        client.release();
    }
});

// Gruppen-Tags abrufen
router.get('/:groupId/tags', authenticateToken, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;

    // Prüfen ob User Mitglied der Gruppe ist
    const memberCheck = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = $3',
      [groupId, userId, 'accepted']
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
    }

    // Alle Tags aus allen Filmen der Gruppe holen
    const result = await db.query(
      `SELECT DISTINCT tags 
       FROM movies 
       WHERE group_id = $1 AND tags IS NOT NULL`,
      [groupId]
    );

    const allTags = [];
    result.rows.forEach(row => {
      try {
        const tags = Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => {
            // Nur öffentliche Tags für Gruppen-Watchlists
            if (tag && tag.label && !tag.is_private) {
              allTags.push({ 
                label: tag.label, 
                color: tag.color || '#2196f3',
                is_private: false
              });
            }
          });
        }
      } catch (e) {
        console.error('Fehler beim Parsen der Tags:', e);
      }
    });

    // Duplikate entfernen (label+color eindeutig)
    const uniqueTags = Array.from(
      new Map(allTags.map(tag => [tag.label + '|' + tag.color, tag])).values()
    );

    res.json(uniqueTags);
  } catch (err) {
    console.error('Fehler beim Laden der Gruppen-Tags:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Gesendete Einladungen abrufen
router.get('/:groupId/invites/sent', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        // Prüfen ob User Creator ist
        const creatorCheck = await db.query(
            'SELECT 1 FROM group_watchlists WHERE id = $1 AND creator_id = $2',
            [groupId, userId]
        );

        if (creatorCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Keine Berechtigung für diese Gruppe' });
        }

        const result = await db.query(
            `SELECT gm.group_id, gm.user_id, u.username as receiver_username, gm.created_at
             FROM group_members gm
             JOIN users u ON gm.user_id = u.id
             WHERE gm.group_id = $1 AND gm.status = 'pending'`,
            [groupId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Fehler beim Abrufen der gesendeten Einladungen:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Empfangene Einladungen abrufen
router.get('/:groupId/invites/received', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            `SELECT gm.group_id, gm.user_id, u.username as sender_username, gm.created_at
             FROM group_members gm
             JOIN group_watchlists gw ON gm.group_id = gw.id
             JOIN users u ON gw.creator_id = u.id
             WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.status = 'pending'`,
            [groupId, userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Fehler beim Abrufen der empfangenen Einladungen:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Einladung zurückziehen
router.post('/:groupId/invites/:inviteId/cancel', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();
    console.log(`[GroupWatchlist] Canceling invite ${req.params.inviteId} for group ${req.params.groupId}`);
    
    try {
        const { groupId, inviteId } = req.params;
        const userId = req.user.id;

        await client.query('BEGIN');

        // Prüfen ob User Creator ist
        const creatorCheck = await client.query(
            'SELECT 1 FROM group_watchlists WHERE id = $1 AND creator_id = $2',
            [groupId, userId]
        );

        if (creatorCheck.rows.length === 0) {
            console.log(`[GroupWatchlist] User ${userId} is not creator of group ${groupId}`);
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Nur der Ersteller kann Einladungen zurückziehen' });
        }

        // Prüfen ob Einladung existiert und noch ausstehend ist
        const inviteCheck = await client.query(
            'SELECT user_id FROM group_members WHERE id = $1 AND group_id = $2 AND status = $3',
            [inviteId, groupId, 'pending']
        );

        if (inviteCheck.rows.length === 0) {
            console.log(`[GroupWatchlist] No pending invite found with ID ${inviteId}`);
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Einladung nicht gefunden' });
        }

        // Einladung löschen
        await client.query(
            'DELETE FROM group_members WHERE id = $1 AND group_id = $2 AND status = $3',
            [inviteId, groupId, 'pending']
        );

        console.log(`[GroupWatchlist] Successfully canceled invite ${inviteId}`);
        await client.query('COMMIT');
        res.json({ message: 'Einladung erfolgreich zurückgezogen' });
    } catch (error) {
        console.error('[GroupWatchlist] Error canceling invite:', error);
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
    } finally {
        client.release();
    }
});

module.exports = router; 