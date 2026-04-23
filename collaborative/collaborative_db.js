const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./cooperative_learning.sqlite');

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
    
    // Migración: agregar columnas si no existen (para BD existente)
    try {
        await dbRun(`ALTER TABLE help_requests ADD COLUMN activation_reason TEXT`);
        await dbRun(`ALTER TABLE help_requests ADD COLUMN roles_detected TEXT`);
        console.log('✅ Columnas migradas a help_requests');
    } catch (e) {
        // Puede fallar si las columnas ya existen - no es crítico
    }
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

const insertParticipationLog = async (channelId, userId, username) => {
    await dbRun(`INSERT INTO participation_log (channel_id, user_id, username) VALUES (?, ?, ?)`, [channelId, userId, username]);
};

const insertHelpRequest = async (channelId, userId, participantsBefore, messageCountBefore, activationReason = 'multi_participant_chat', rolesDetected = '[]') => {
    await dbRun(`INSERT INTO help_requests (channel_id, user_id, participants_before, message_count_before, activation_reason, roles_detected) VALUES (?, ?, ?, ?, ?, ?)`, [channelId, userId, participantsBefore, messageCountBefore, activationReason, rolesDetected]);
};

const insertBotIntervention = async (channelId, interventionType) => {
    await dbRun(`INSERT INTO bot_interventions (channel_id, intervention_type) VALUES (?, ?)`, [channelId, interventionType]);
};

const getRoles = async(channelId) =>  {
    return await dbAll(`SELECT user_id, username, role_name FROM team_roles WHERE channel_id = ?`, [channelId]);
};

const getRecentMessagesWithRoleMentions = async (channelId, limit = 10) => {
    return await dbAll(`SELECT p.user_id, p.username, p.role_name 
                FROM participation_log p
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
    recordSuggestion
}
