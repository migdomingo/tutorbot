const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./collaborative_learning.sqlite');

console.log("=== 📊 TFM DATA ANALYSIS REPORT ===\n");

db.serialize(() => {
    // ============================================================
    // 1. DIMENSIÓN SUBJETIVA: Media de la Encuesta (Modelo TAM)
    // ============================================================
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

    // ============================================================
    // 2. DIMENSIÓN SOCIAL: Coevaluación (Peer Review)
    // ============================================================
    db.get(`SELECT AVG(score) as avg_peer FROM peer_reviews`, (err, row) => {
        console.log("--- COEVALUACIÓN ENTRE PARES ---");
        console.log(`Media de valoración entre compañeros: ${row.avg_peer?.toFixed(2)} / 5\n`);
    });

    // ============================================================
    // 3. ANÁLISIS POR ROLES (Distribución de la participación)
    // ============================================================
    db.all(`SELECT role_name, COUNT(*) as total FROM team_roles GROUP BY role_name`, (err, rows) => {
        console.log("--- DISTRIBUCIÓN DE ROLES CONFIGURADOS ---");
        rows.forEach(r => console.log(`${r.role_name}: ${r.total} asignaciones`));
        console.log("");
    });

    // ============================================================
    // 4. METADATOS DEL PROCESO COLABORATIVO
    // ============================================================

    // 4a) Solicitudes de ayuda por canal (help_requests)
    db.all(`SELECT channel_id, COUNT(*) as total_requests FROM help_requests GROUP BY channel_id ORDER BY total_requests DESC`, (err, helpRows) => {
        console.log("--- SOLICITUDES DE AYUDA POR CANAL ---");
        if (helpRows.length === 0) {
            console.log("No hay solicitudes registradas.\n");
        } else {
            helpRows.forEach(r => console.log(`Canal ${r.channel_id}: ${r.total_requests} solicitudes`));
            console.log("");
        }

        // 4b) Momento de las solicitudes (inicio/medio/final) por canal
        db.all(`SELECT channel_id, timestamp FROM help_requests ORDER BY channel_id, timestamp`, (err, allHelp) => {
            const countsByChannel = {};
            allHelp.forEach(r => {
                countsByChannel[r.channel_id] = (countsByChannel[r.channel_id] || 0) + 1;
            });

            const countersByChannel = {};
            const momentsByChannel = {};

            allHelp.forEach(r => {
                const ch = r.channel_id;
                countersByChannel[ch] = (countersByChannel[ch] || 0) + 1;
                const position = countersByChannel[ch];
                const total = countsByChannel[ch];

                if (!momentsByChannel[ch]) momentsByChannel[ch] = { inicio: 0, medio: 0, final: 0 };

                if (position <= Math.ceil(total / 3)) momentsByChannel[ch].inicio++;
                else if (position <= Math.ceil(total * 2 / 3)) momentsByChannel[ch].medio++;
                else momentsByChannel[ch].final++;
            });

            console.log("--- DISTRIBUCIÓN TEMPORAL DE AYUDA POR CANAL ---");
            Object.entries(momentsByChannel).forEach(([ch, moments]) => {
                console.log(`Canal ${ch}: Inicio=${moments.inicio} | Medio=${moments.medio} | Final=${moments.final}`);
            });
            console.log("");

            // 4c) Participación: Alumnos activos y mensajes por alumno
            db.all(`
                SELECT 
                    channel_id,
                    COUNT(DISTINCT user_id) as active_students,
                    COUNT(*) as total_messages,
                    AVG(msg_count) as avg_msgs_per_student,
                    MAX(msg_count) as max_msgs_per_student
                FROM (
                    SELECT channel_id, user_id, COUNT(*) as msg_count
                    FROM participation_log
                    GROUP BY channel_id, user_id
                )
                GROUP BY channel_id
                ORDER BY channel_id
            `, (err, partRows) => {
                console.log("--- PARTICIPACIÓN POR CANAL ---");
                partRows.forEach(r => {
                    console.log(`Canal ${r.channel_id}:`);
                    console.log(`  - Alumnos activos: ${r.active_students}`);
                    console.log(`  - Mensajes totales: ${r.total_messages}`);
                    console.log(`  - Media msgs/alumno: ${r.avg_msgs_per_student?.toFixed(1)}`);
                    console.log(`  - Máximo msgs/alumno: ${r.max_msgs_per_student}`);
                    console.log("");
                });

                // 4d) Intervenciones del bot por canal y tipo
                db.all(`
                    SELECT channel_id, intervention_type, COUNT(*) as count
                    FROM bot_interventions
                    GROUP BY channel_id, intervention_type
                    ORDER BY channel_id, count DESC
                `, (err, botRows) => {
                    console.log("--- INTERVENCIONES DEL BOT POR CANAL Y TIPO ---");
                    const botStats = {};
                    botRows.forEach(r => {
                        if (!botStats[r.channel_id]) botStats[r.channel_id] = { total: 0, tipos: {} };
                        botStats[r.channel_id].total += r.count;
                        botStats[r.channel_id].tipos[r.intervention_type] = r.count;
                    });

                    Object.entries(botStats).forEach(([ch, stats]) => {
                        console.log(`Canal ${ch} (Total: ${stats.total} intervenciones):`);
                        Object.entries(stats.tipos).forEach(([type, count]) => {
                            const pct = ((count / stats.total) * 100).toFixed(1);
                            console.log(`  - ${type}: ${count} (${pct}%)`);
                        });
                        console.log("");
                    });

                    // ============================================================
                    // 5. DIAGNÓSTICO ORIENTATIVO POR GRUPO
                    // ============================================================
                    console.log("--- DIAGNÓSTICO ORIENTATIVO POR GRUPO ---");
                    console.log("(Basado en métricas de proceso, NO es nota ni juicio)\n");

                    partRows.forEach(r => {
                        const ch = r.channel_id;
                        const active = r.active_students;
                        const totalMsgs = r.total_messages;
                        const avgMsgs = r.avg_msgs_per_student;
                        const maxMsgs = r.max_msgs_per_student;

                        const helpCount = helpRows.find(h => h.channel_id === ch)?.total_requests || 0;
                        const botStatsCh = botStats[ch] || { total: 0, tipos: {} };
                        const botTotal = botStatsCh.total;
                        const monitorPct = botStatsCh.tipos['monitorizacion'] || 0;
                        const coordPct = botStatsCh.tipos['coordinacion'] || 0;
                        const conflictPct = botStatsCh.tipos['conflicto_sociocognitivo'] || 0;

                        const equalityIndex = maxMsgs / (avgMsgs || 1);

                        let diagnostic = `Grupo canal ${ch}: `;

                        if (helpCount > 5) {
                            diagnostic += "Alto uso del facilitador externo. ";
                        } else if (helpCount <= 2) {
                            diagnostic += "Bajo uso del facilitador; promueven autonomía. ";
                        } else {
                            diagnostic += "Uso moderado del facilitador. ";
                        }

                        if (equalityIndex > 1.8) {
                            diagnostic += "Participación desequilibrada (algunos compañeros dominan la conversación). ";
                        } else if (equalityIndex < 1.3) {
                            diagnostic += "Participación equilibrada entre miembros. ";
                        } else {
                            diagnostic += "Participación moderadamente distribuida. ";
                        }

                        if (botTotal > helpCount * 1.5) {
                            diagnostic += "El bot interviene frecuentemente incluso sin ser solicitado. ";
                        } else if (botTotal < helpCount) {
                            diagnostic += "El bot interviene solo cuando se le solicita. ";
                        } else {
                            diagnostic += "Intervenciones del bot alineadas con las solicitudes. ";
                        }

                        if (coordPct > monitorPct && coordPct > conflictPct) {
                            diagnostic += "El bot se enfoca en coordinar roles y tareas. ";
                        } else if (monitorPct > coordPct && monitorPct > conflictPct) {
                            diagnostic += "El bot prioriza la monitorización del progreso. ";
                        } else if (conflictPct > coordPct && conflictPct > monitorPct) {
                            diagnostic += "El bot promueve conflicto sociocognitivo (cuestionamiento). ";
                        } else {
                            diagnostic += "No hay un patrón claro en los tipos de intervención. ";
                        }

                        if (helpCount < 3 && equalityIndex < 1.3 && botTotal < helpCount) {
                            diagnostic += "Perfil: Alta autorregulación grupal.";
                        } else if (helpCount > 5 && botTotal > helpCount) {
                            diagnostic += "Perfil: Dependencia del regulador externo (bot).";
                        } else if (equalityIndex > 1.8) {
                            diagnostic += "Perfil: Participación desequilibrada, requiere atención a equidad.";
                        } else {
                            diagnostic += "Perfil: En desarrollo, con áreas de mejora identificables.";
                        }

                        console.log(diagnostic);
                        console.log("");
                    });

                    // ============================================================
                    // 6. VALORACIONES CUALITATIVAS PARA EL DOCENTE
                    // ============================================================
                    db.all(`
                        SELECT channel_id, timestamp, participation_summary, regulation_summary, 
                               collaboration_summary, strengths, improvement_suggestions, overall_assessment
                        FROM teacher_assessments
                        ORDER BY channel_id, timestamp DESC
                    `, (err, assessRows) => {
                        console.log("\n=== 📋 INFORMES PEDAGÓGICOS POR GRUPO (Teacher Assessments) ===\n");

                        if (err) {
                            console.error('Error leyendo teacher_assessments:', err);
                            console.log("No se pudieron cargar las valoraciones cualitativas.\n");
                        } else if (!assessRows || assessRows.length === 0) {
                            console.log("⚠️  No existen valoraciones cualitativas generadas aún para ningún grupo.\n");
                            console.log("   El docente puede generar informes con el comando !informe_docente (privado).\n");
                        } else {
                            const assessmentsByChannel = {};
                            assessRows.forEach(row => {
                                if (!assessmentsByChannel[row.channel_id]) {
                                    assessmentsByChannel[row.channel_id] = [];
                                }
                                assessmentsByChannel[row.channel_id].push(row);
                            });

                            Object.entries(assessmentsByChannel).forEach(([channelId, assessments]) => {
                                const latest = assessments[0];
                                const date = new Date(latest.timestamp).toLocaleString('es-ES', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                });

                                console.log(`────────────────────────────────────────────`);
                                console.log(`📁  CANAL: ${channelId}`);
                                console.log(`📅  Fecha valoración: ${date}`);
                                console.log(``);

                                console.log(`👥 PARTICIPACIÓN:`);
                                console.log(`   ${latest.participation_summary}`);
                                console.log(``);

                                console.log(`📊 REGULACIÓN DEL APRENDIZAJE:`);
                                console.log(`   ${latest.regulation_summary}`);
                                console.log(``);

                                console.log(`🤝 FUNCIONAMIENTO COLABORATIVO:`);
                                console.log(`   ${latest.collaboration_summary}`);
                                console.log(``);

                                console.log(`✨ FORTALEZAS DETECTADAS:`);
                                console.log(`   ${latest.strengths}`);
                                console.log(``);

                                console.log(`💡 SUGERENCIAS DE MEJORA:`);
                                console.log(`   ${latest.improvement_suggestions}`);
                                console.log(``);

                                console.log(`📝 VALORACIÓN GLOBAL:`);
                                console.log(`   ${latest.overall_assessment}`);
                                console.log(``);

                                if (assessments.length > 1) {
                                    console.log(`   (Existen ${assessments.length - 1} valoraciones anteriores para este grupo. Se muestra solo la más reciente.)\n`);
                                }
                            });
                        }

                        // ============================================================
                        // 7. COMENTARIOS CUALITATIVOS DE ENCUESTA
                        // ============================================================
                        db.all(`SELECT q4_open_comment FROM survey_results LIMIT 5`, (err, rows) => {
                            console.log("--- MUESTRA DE COMENTARIOS CUALITATIVOS DE ENCUESTA (Para Citas) ---");
                            rows.forEach((r, i) => console.log(`${i+1}. "${r.q4_open_comment}"`));
                            db.close();
                        });
                    });
                });
            });
        });
    });
});