const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./cooperative_learning.sqlite');

console.log("=== 📊 TFM DATA ANALYSIS REPORT ===\n");

db.serialize(() => {
    // 1. DIMENSIÓN SUBJETIVA: Media de la Encuesta (Modelo TAM)
    db.get(`SELECT 
            AVG(q1_utility) as util, 
            AVG(q2_interdependence) as coop, 
            AVG(q3_ease_of_use) as ease 
            FROM survey_results`, (err, row) => {
        console.log("--- PERCEPCIÓN DEL ALUMNADO (Media 1-5) ---");
        console.log(`Utilidad Percibida: ${row.util?.toFixed(2)}`);
        console.log(`Efecto en la Cooperación: ${row.coop?.toFixed(2)}`);
        console.log(`Facilidad de Uso: ${row.ease?.toFixed(2)}\n`);
    });

    // 2. DIMENSIÓN SOCIAL: Coevaluación (Peer Review)
    db.get(`SELECT AVG(score) as avg_peer FROM peer_reviews`, (err, row) => {
        console.log("--- COEXISTENCIA SOCIAL ---");
        console.log(`Media de valoración entre compañeros: ${row.avg_peer?.toFixed(2)} / 5\n`);
    });

    // 3. ANÁLISIS POR ROLES (Distribución de la participación)
    // Here we check how many students had each role assigned
    db.all(`SELECT role_name, COUNT(*) as total FROM team_roles GROUP BY role_name`, (err, rows) => {
        console.log("--- DISTRIBUCIÓN DE ROLES CONFIGURADOS ---");
        rows.forEach(r => console.log(`${r.role_name}: ${r.total} asignaciones`));
        console.log("");
    });

    // 4. CORRELACIÓN CUALITATIVA (Comentarios destacados)
    db.all(`SELECT q4_open_comment FROM survey_results LIMIT 5`, (err, rows) => {
        console.log("--- MUESTRA DE COMENTARIOS CUALITATIVOS (Para Citas) ---");
        rows.forEach((r, i) => console.log(`${i+1}. "${r.q4_open_comment}"`));
        db.close();
    });
});