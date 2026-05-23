const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./collaborative_learning.sqlite');

// Promisify all db methods
const dbPromise = new Promise((resolve, reject) => {
    db.serialize(() => {
        resolve();
    });
});

const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbInitialize = async () => {
    console.log('Initializing database...');
    await dbRun(`
        CREATE TABLE IF NOT EXISTS team_roles (
            channel_id TEXT,
            user_id TEXT,
            username TEXT,
            role_name TEXT,
            PRIMARY KEY (channel_id, user_id)
        )
    `);
    await dbRun(`
        CREATE TABLE IF NOT EXISTS peer_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            reviewer_id TEXT,
            reviewee_id TEXT,
            score INTEGER,
            comment TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await dbRun(`
        CREATE TABLE IF NOT EXISTS survey_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            user_id TEXT,
            username TEXT,
            q1_utility INTEGER,
            q2_interdependence INTEGER,
            q3_ease_of_use INTEGER,
            q4_open_comment TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await dbRun(`
        CREATE TABLE IF NOT EXISTS help_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            user_id TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            participants_before INTEGER,
            message_count_before INTEGER,
            activation_reason TEXT,
            roles_detected TEXT
        )
    `);
    await dbRun(`
        CREATE TABLE IF NOT EXISTS participation_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            user_id TEXT,
            username TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await dbRun(`
        CREATE TABLE IF NOT EXISTS bot_interventions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            intervention_type TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await dbRun(`
        CREATE TABLE IF NOT EXISTS teacher_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            participation_summary TEXT,
            regulation_summary TEXT,
            collaboration_summary TEXT,
            strengths TEXT,
            improvement_suggestions TEXT,
            overall_assessment TEXT
        )
    `);

    // NEW: Track bot suggestions to avoid repetition
    await dbRun(`
        CREATE TABLE IF NOT EXISTS bot_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT,
            role TEXT,
            suggestion_text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // NEW: Contexto de la actividad declarado por el docente
    await dbRun(`
        CREATE TABLE IF NOT EXISTS activity_context (
            channel_id TEXT PRIMARY KEY,
            domain TEXT,
            topic TEXT,
            task_type TEXT,
            required_parts TEXT,
            role_mapping TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Migración: agregar columnas si no existen (para BD existente)
    try {
        await dbRun(`ALTER TABLE help_requests ADD COLUMN activation_reason TEXT`);
        await dbRun(`ALTER TABLE help_requests ADD COLUMN roles_detected TEXT`);
        await dbRun(`ALTER TABLE help_requests ADD COLUMN mode TEXT DEFAULT 'collaborative'`);
        console.log('✅ Columnas migradas a help_requests');
    } catch (e) {
        // Puede fallar si las columnas ya existen - no es crítico
    }
    
    // Add mode column to bot_interventions
    try {
        await dbRun(`ALTER TABLE bot_interventions ADD COLUMN mode TEXT DEFAULT 'collaborative'`);
        console.log('✅ Columna mode añadida a bot_interventions');
    } catch (e) {
        // Puede fallar si la columna ya existe - no es crítico
    }
    
    // Add mode column to participation_log
    try {
        await dbRun(`ALTER TABLE participation_log ADD COLUMN mode TEXT DEFAULT 'collaborative'`);
        console.log('✅ Columna mode añadida a participation_log');
    } catch (e) {
        // Puede fallar si la columna ya existe - no es crítico
    }
    
    // Add mode column to teacher_assessments
    try {
        await dbRun(`ALTER TABLE teacher_assessments ADD COLUMN mode TEXT DEFAULT 'collaborative'`);
        console.log('✅ Columna mode añadida a teacher_assessments');
    } catch (e) {
        // Puede fallar si la columna ya existe - no es crítico
    }
    await ensureColumnExists('help_requests', 'mode', "TEXT DEFAULT 'collaborative'");
    await ensureColumnExists('bot_interventions', 'mode', "TEXT DEFAULT 'collaborative'");
    await ensureColumnExists('participation_log', 'mode', "TEXT DEFAULT 'collaborative'");
    await ensureColumnExists('teacher_assessments', 'mode', "TEXT DEFAULT 'collaborative'");
    await ensureColumnExists('survey_results', 'channel_id', 'TEXT');
};

const clearChannelData = async (channelId) => {
    await dbRun(`DELETE FROM help_requests WHERE channel_id = ?`, [channelId]);
    await dbRun(`DELETE FROM participation_log WHERE channel_id = ?`, [channelId]);
    await dbRun(`DELETE FROM bot_interventions WHERE channel_id = ?`, [channelId]);
    await dbRun(`DELETE FROM peer_reviews WHERE channel_id = ?`, [channelId]);
};

const upsertRole = async (channelId, userId, username, roleName) => {
    await dbRun(`INSERT OR REPLACE INTO team_roles (channel_id, user_id, username, role_name) VALUES (?, ?, ?, ?)`, [channelId, userId, username, roleName]);
};

const insertPeerReview = async (channelId, reviewerId, revieweeId, score, comment) => {
    await dbRun(`INSERT INTO peer_reviews (channel_id, reviewer_id, reviewee_id, score, comment) VALUES (?, ?, ?, ?, ?)`, [channelId, reviewerId, revieweeId, score, comment]);
};

const insertSurveyResult = async (channelId, userId, username, q1, q2, q3, comment) => {
    await dbRun(`INSERT INTO survey_results (channel_id, user_id, username, q1_utility, q2_interdependence, q3_ease_of_use, q4_open_comment) VALUES (?, ?, ?, ?, ?, ?, ?)`, [channelId, userId, username, q1, q2, q3, comment]);
};

const insertParticipationLog = async (channelId, userId, username, mode = 'collaborative') => {
    await dbRun(`INSERT INTO participation_log (channel_id, user_id, username, mode) VALUES (?, ?, ?, ?)`, [channelId, userId, username, mode]);
};

const insertHelpRequest = async (channelId, userId, participantsBefore, messageCountBefore, activationReason = 'multi_participant_chat', rolesDetected = '[]', mode = 'collaborative') => {
    await dbRun(`INSERT INTO help_requests (channel_id, user_id, participants_before, message_count_before, activation_reason, roles_detected, mode) VALUES (?, ?, ?, ?, ?, ?, ?)`, [channelId, userId, participantsBefore, messageCountBefore, activationReason, rolesDetected, mode]);
};

const insertBotIntervention = async (channelId, interventionType, mode = 'collaborative') => {
    await dbRun(`INSERT INTO bot_interventions (channel_id, intervention_type, mode) VALUES (?, ?, ?)`, [channelId, interventionType, mode]);
};

const getRoles = async(channelId) =>  {
    return await dbAll(`SELECT user_id, username, role_name FROM team_roles WHERE channel_id = ?`, [channelId]);
};

const getRecentMessagesWithRoleMentions = async (channelId, limit = 10) => {
    return await dbAll(`SELECT p.user_id, p.username, t.role_name
                FROM participation_log p
                LEFT JOIN team_roles t ON p.user_id = t.user_id AND p.channel_id = t.channel_id
                WHERE p.channel_id = ?
                ORDER BY p.timestamp DESC
                LIMIT ?`, [channelId, limit]);
};

const getRecentSuggestions = async (channelId, role, limit = 3) => {
    return await dbAll(`SELECT suggestion_text FROM bot_suggestions 
                       WHERE channel_id = ? AND role = ? 
                       ORDER BY timestamp DESC LIMIT ?`, 
                       [channelId, role, limit]);
};

const recordSuggestion = async (channelId, role, suggestionText) => {
    await dbRun(`INSERT INTO bot_suggestions (channel_id, role, suggestion_text) VALUES (?, ?, ?)`, 
                [channelId, role, suggestionText]);
};

// OPTIONAL: Read functions filtered by mode (for analysis)
const getHelpRequestsByMode = async (channelId, mode) => {
    return await dbAll(`SELECT * FROM help_requests WHERE channel_id = ? AND mode = ? ORDER BY timestamp`, [channelId, mode]);
};

const getBotInterventionsByMode = async (channelId, mode) => {
    return await dbAll(`SELECT * FROM bot_interventions WHERE channel_id = ? AND mode = ? ORDER BY timestamp`, [channelId, mode]);
};

const getParticipationLogByMode = async (channelId, mode) => {
    return await dbAll(`SELECT * FROM participation_log WHERE channel_id = ? AND mode = ? ORDER BY timestamp`, [channelId, mode]);
};


const ensureColumnExists = async (table, column, definition) => {
  const cols = await dbAll(`PRAGMA table_info(${table})`);
  const exists = cols.some(c => c.name === column);

  if (!exists) {
    console.log(`[DB MIGRATION] Añadiendo ${column} a ${table}`);
    await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};


const getLastAutomaticIntervention = async (channelId) => {
    return await dbGet(
        `SELECT timestamp FROM bot_interventions
         WHERE channel_id = ? AND intervention_type = 'automatic_milestone'
         ORDER BY timestamp DESC LIMIT 1`,
        [channelId]
    );
};

const getChannelStats = async (channelId) => {
    const roles = await dbAll(`SELECT user_id, username, role_name FROM team_roles WHERE channel_id = ?`, [channelId]);
    const helpRow = await dbGet(`SELECT COUNT(*) as count FROM help_requests WHERE channel_id = ?`, [channelId]);
    const interventions = await dbAll(
        `SELECT intervention_type, COUNT(*) as count FROM bot_interventions WHERE channel_id = ? GROUP BY intervention_type`,
        [channelId]
    );
    const participation = await dbAll(
        `SELECT user_id, username, COUNT(*) as msg_count FROM participation_log WHERE channel_id = ? GROUP BY user_id, username ORDER BY msg_count DESC`,
        [channelId]
    );
    const peerReviews = await dbAll(`SELECT reviewer_id, reviewee_id, score, comment FROM peer_reviews WHERE channel_id = ?`, [channelId]);
    return { roles, helpCount: helpRow?.count || 0, interventions, participation, peerReviews };
};

const insertTeacherAssessment = async (channelId, data, mode = 'collaborative') => {
    await dbRun(
        `INSERT INTO teacher_assessments
         (channel_id, participation_summary, regulation_summary, collaboration_summary,
          strengths, improvement_suggestions, overall_assessment, mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [channelId, data.participation_summary, data.regulation_summary, data.collaboration_summary,
         data.strengths, data.improvement_suggestions, data.overall_assessment, mode]
    );
};

const upsertActivityContext = async (channelId, domain, topic, taskType, requiredParts, roleMapping) => {
    await dbRun(`
        INSERT OR REPLACE INTO activity_context 
        (channel_id, domain, topic, task_type, required_parts, role_mapping, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [channelId, domain, topic, taskType, typeof requiredParts === 'string' ? requiredParts : JSON.stringify(requiredParts), typeof roleMapping === 'string' ? roleMapping : JSON.stringify(roleMapping)]);
};

const getActivityContext = async (channelId) => {
    const row = await dbGet(`SELECT * FROM activity_context WHERE channel_id = ?`, [channelId]);
    if (row && row.required_parts && row.role_mapping) {
        try {
            row.required_parts = JSON.parse(row.required_parts);
            row.role_mapping = JSON.parse(row.role_mapping);
        } catch (e) {
            console.error('Error parsing JSON from activity_context', e);
        }
    }
    return row;
};

module.exports = {
    dbInitialize,
    clearChannelData,
    upsertRole,
    insertPeerReview,
    insertSurveyResult,
    insertParticipationLog,
    insertHelpRequest,
    getRoles,
    getRecentMessagesWithRoleMentions,
    insertBotIntervention,
    dbRun,
    dbAll,
    getRecentSuggestions,
    recordSuggestion,
    getLastAutomaticIntervention,
    getChannelStats,
    insertTeacherAssessment,
    // Optional read functions for analysis
    getHelpRequestsByMode,
    getBotInterventionsByMode,
    getParticipationLogByMode,
    upsertActivityContext,
    getActivityContext
}
