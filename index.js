require('dotenv').config();
const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    PermissionFlagsBits, Events, EmbedBuilder 
} = require('discord.js');
const { OpenAI } = require('openai');
const scenarioConfig = require('./scenarios/scenario_project.js');
const { dbInitialize, clearChannelData, upsertRole, insertPeerReview, insertSurveyResult, insertParticipationLog, insertHelpRequest, getRoles, dbRun, insertBotIntervention } = require('./cooperative/cooperative_db.js');
const { commands } = require('./cooperative/commands.js');
// --- 1. SETTINGS ---
const openai = new OpenAI({ 
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1" 
});

dbInitialize();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Deploy Commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
        console.log('✅ Cooperative Commands Registered');
    } catch (err) { console.error(err); }
})();


// --- 4. INTERACTION HANDLERS ---

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Handle Reset Command (limpiar datos de análisis del canal)
    if (interaction.commandName === 'reset') {
        const channelId = interaction.channelId;

        clearChannelData(channelId);

        return interaction.reply({
            content: '🧹 Datos de análisis del canal eliminados: solicitudes de ayuda, participación, intervenciones del bot y coevaluaciones.',
            ephemeral: false
        });
    }

    // Handle Role Assignment (also clear analysis data)
    if (interaction.commandName === 'asignar_roles') {
        const channelId = interaction.channelId;

        clearChannelData(channelId);

        const roles = [
            { id: interaction.options.getUser('lider').id, name: 'Coordinador/Scrum Master', user: interaction.options.getUser('lider').username },
            { id: interaction.options.getUser('secretario').id, name: 'Secretario/Scribe', user: interaction.options.getUser('secretario').username },
            { id: interaction.options.getUser('critico').id, name: 'Portavoz/Crítico', user: interaction.options.getUser('critico').username }
        ];

        for (const r of roles) {
            await upsertRole(interaction.channelId, r.id, r.user, r.name);
        }

        await interaction.reply(`👥 **Roles de Equipo Asignados:**\n` + roles.map(r => `• **${r.name}**: ${r.user}`).join('\n') + `\n\n🧹 Datos de análisis anteriores limpiados.`);
    }

    // Handle Peer Review (Coevaluación)
    if (interaction.commandName === 'co_evaluar') {
        const student = interaction.options.getUser('estudiante');
        const score = interaction.options.getInteger('nota');
        const comment = interaction.options.getString('comentario');

        if (student.id === interaction.user.id) return interaction.reply({ content: 'No puedes evaluarte a ti mismo.', ephemeral: true });

        try {
            await insertPeerReview(interaction.channelId, interaction.user.id, student.id, score, comment);
            return interaction.reply({ content: `✅ Has evaluado a **${student.username}** con un ${score}/5.`, ephemeral: true });
        } catch (err) {
            console.error('Error saving peer review:', err);
            return interaction.reply('Error al guardar coevaluación.');
        }
    }

    if (interaction.commandName === 'encuesta') {
        const q1 = interaction.options.getInteger('utilidad');
        const q2 = interaction.options.getInteger('colaboracion');
        const q3 = interaction.options.getInteger('facilidad');
        const comment = interaction.options.getString('comentario');

        try {
            await insertSurveyResult(interaction.channelId, interaction.user.id, interaction.user.username, q1, q2, q3, comment);
            return interaction.reply({ content: '✅ ¡Gracias! Tu opinión es fundamental para mi investigación (TFM).', ephemeral: true });
        } catch (err) {
            console.error('Error saving survey:', err);
            return interaction.reply({ content: '❌ Error al guardar la encuesta.', ephemeral: true });
        }        
    } 
});

// --- 5. AI ORCHESTRATOR WITH INTERDEPENDENCE GATE ---

/**
 * Analyze recent chat context to inform strategic scaffolding
 */
async function analyzeChatContext(message) {
    const analysis = {
        recentMessageCount: 0,
        distinctAuthors: 0,
        activeRoles: { coordinator: false, secretary: false, critic: false },
        conversationStage: 'inicio',
        groupState: 'productive',
        ideaQuality: 'balanced',
        functionalInactivity: [],
        recommendedScaffoldingLevel: 'medium'
    };

    try {
        let recentMessages = message.channel.messages.cache.filter(m => !m.author.bot);
        if (recentMessages.size < 10) {
            const fetched = await message.channel.messages.fetch({ limit: 20 });
            recentMessages = fetched.filter(m => !m.author.bot);
        }
        const msgsArray = Array.from(recentMessages.values())
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
            .slice(0, 20);

        analysis.recentMessageCount = msgsArray.length;
        analysis.distinctAuthors = new Set(msgsArray.map(m => m.author.id)).size;

        const roleMsgCount = { coordinator: 0, secretary: 0, critic: 0 };
        msgsArray.forEach(m => {
            const u = m.author.username.toLowerCase();
            const c = m.content.toLowerCase();
            if (u.includes('coord') || u.includes('scrum') || c.includes('coordinador')) { analysis.activeRoles.coordinator = true; roleMsgCount.coordinator++; }
            if (u.includes('secre') || u.includes('escriba') || c.includes('secretario')) { analysis.activeRoles.secretary = true; roleMsgCount.secretary++; }
            if (u.includes('critico') || u.includes('portavoz') || c.includes('crítico')) { analysis.activeRoles.critic = true; roleMsgCount.critic++; }
        });

        analysis.conversationStage = analysis.recentMessageCount <= 10 ? 'inicio' :
                                      analysis.recentMessageCount <= 30 ? 'desarrollo' : 'cierre';

        // --- DIAGNOSIS ---
        const progressIndicators = msgsArray.filter(m => /hecho|listo|avanzad|terminad|complet|siguiente|paso|siguiendo|avance/.test(m.content)).length;
        const questionIndicators = msgsArray.filter(m => /\?|cómo|qué|cuál|dónde|cuándo|por qué/.test(m.content)).length;

        if (analysis.recentMessageCount >= 15 && progressIndicators === 0 && questionIndicators > 5) analysis.groupState = 'blocked';
        else if (analysis.distinctAuthors < 3 && analysis.recentMessageCount > 10) analysis.groupState = 'scattered';
        else if (questionIndicators < 2 && progressIndicators > analysis.recentMessageCount * 0.6) analysis.groupState = 'superficial_consensus';
        else analysis.groupState = 'productive';

        const decisionIndicators = msgsArray.filter(m => /decidimos|elegimos|votamos|acordamos|quedamos en/.test(m.content)).length;
        const justificationIndicators = msgsArray.filter(m => /porque|ya que|dado que|debido a|justifica|razón/.test(m.content)).length;

        if (decisionIndicators === 0 && analysis.recentMessageCount > 10) analysis.ideaQuality = 'many_undecided';
        else if (decisionIndicators > 0 && justificationIndicators < decisionIndicators * 0.5) analysis.ideaQuality = 'few_well_justified';
        else analysis.ideaQuality = 'balanced';

        if (analysis.conversationStage === 'desarrollo' || analysis.conversationStage === 'cierre') {
            if (!analysis.activeRoles.coordinator && roleMsgCount.coordinator === 0) analysis.functionalInactivity.push('coordinador');
            if (!analysis.activeRoles.secretary && roleMsgCount.secretary === 0) analysis.functionalInactivity.push('secretario');
            if (!analysis.activeRoles.critic && roleMsgCount.critic === 0) analysis.functionalInactivity.push('critico');
        }

        if (analysis.groupState === 'blocked' || analysis.functionalInactivity.length >= 2) analysis.recommendedScaffoldingLevel = 'high';
        else if (analysis.groupState === 'scattered' || analysis.functionalInactivity.length === 1) analysis.recommendedScaffoldingLevel = 'medium';
        else analysis.recommendedScaffoldingLevel = 'light';

    } catch (e) { console.error('Context analysis error:', e); }
    return analysis;
}

/**
 * Classify bot intervention type based on response content
 */
function classifyIntervention(text) {
    const t = text.toLowerCase();
    if (/ritmo|tiempo|avance|progreso|revisad/.test(t)) return 'monitorizacion';
    if (/coordinador|secretario|crítico|repart|tarea|organiz/.test(t)) return 'coordinacion';
    if (/segur|alternativa|mejora|fallo|error|cuestion|profundizad/.test(t)) return 'conflicto_sociocognitivo';
    return 'otro';
}

/**
 * Get action models (suggestions) for a given role and stage
 */
function getActionModelsByRole(role, stage) {
    const models = {
        coordinator: {
            inicio: [
                "Podrías proponer un plan de trabajo con 3-4 hitos claros y responsables asociados",
                "Una estrategia útil: definid el producto final y luego worked backwards para identificar subtareas",
                "Considera usar la técnica '6 Thinking Hats' para asignar perspectivas iniciales",
                "Intenta establecer un timeline con tiempos estimados por subtarea y un checkpoint a mitad"
            ],
            desarrollo: [
                "Revisa el reparto actual: ¿cada miembro tiene una responsabilidad exclusiva y clara?",
                "Propón un 'scrum daily' de 2 minutos: cada uno dice qué hizo, qué hará, qué bloquea",
                "Si hay cuellos de botella, sugiere emparejamiento (pair programming) o rotación de tareas",
                "Puedes implementar un Kanban visual (To Do / Doing / Done) en un documento compartido"
            ],
            cierre: [
                "Guía una revisión final checklist: ¿todos los requisitos cubiertos? ¿calidad mínima?",
                "Coordina una prueba cruzada: cada uno revisa el trabajo de otro según criterios definidos",
                "Preparad la defensa: asignad qué expone cada miembro y practiced el discurso",
                "Cerrad con una retrospectiva rápida: ¿qué funcionó? ¿qué mejoraríais la próxima vez?"
            ]
        },
        secretary: {
            inicio: [
                "Propón una estructura de acta inicial: objetivos, tareas, responsables, plazos",
                "Podrías usar una plantilla con columnas: IDEA | RESPONSABLE | FECHA | ESTADO",
                "Documenta las decisiones tomadas con rationale: 'por qué elegimos X sobre Y'",
                "Cread un documento compartido con secciones claras y acceso a todos"
            ],
            desarrollo: [
                "Registra no solo acuerdos, también dudas pendientes y decisiones reversibles",
                "Sugiere un formato de resumen por sesión: logros, bloqueos, siguientes pasos",
                "Propón mantener un glosario compartido de términos clave que vayan surgiendo",
                "Documenta también las alternativas descartadas y por qué (para aprender)"
            ],
            cierre: [
                "Sintetiza en 3 párrafos: (1) objetivo, (2) proceso seguido, (3) resultado",
                "Elabora una lista de 'lecciones aprendidas' con ejemplos concretos del trabajo",
                "Prepara un acta estructurada que sirva como memoria del proyecto",
                "Crea un resumen ejecutivo que cualquier persona externa pueda entender"
            ]
        },
        critic: {
            inicio: [
                "Plantea preguntas de clarificación: ¿qué asumimos? ¿qué evidencias tenemos?",
                "Sugiere identificar 'supuestos clave' y cómo testarlos temprano",
                "Propón definir criterios de éxito ANTES de avanzar: ¿cómo sabremos si funciona?",
                "Cuestiona si el enfoque elegido es el más eficiente o solo el más obvio"
            ],
            desarrollo: [
                "Aplica el test '5 Whys': preguntad 'por qué' sucesivamente para llegar a la raíz",
                "Revisad la coherencia interna: ¿todas las partes encajan lógicamente?",
                "Identificad posibles puntos de fallo y preparad planes B",
                "Propón una 'sesión de devil's advocate': alguien debe argumentar en contra de la idea principal"
            ],
            cierre: [
                "Someter el trabajo a estos filtros: ¿es viable? ¿está justificado? ¿es completo?",
                "Revisad posibles sesgos: ¿estamos ignorando información incómoda?",
                "Evaluad alternativas no consideradas: ¿habría otra forma mejor de hacerlo?",
                "Propón una autocrítica estructurada: 3 aciertos, 3 áreas de mejora, 3 aprendizajes"
            ]
        }
    };

    const list = models[role] && models[role][stage] ? models[role][stage] : ["Reflexiona sobre tu rol y cómo aportar más valor al equipo."];
    return list.sort(() => 0.5 - Math.random()).slice(0, 3);
}

client.on(Events.MessageCreate, async message => {
    // Log participation
    if (!message.author.bot) {
        //TODO: log participation log
        try {
            await insertParticipationLog(message.channelId, message.author.id, message.author.username);
        } catch (error) {
            console.error('Error logging participation:', error);
        }
    }

    // === Docente: informe cualitativo ===
    if (message.content === '!informe_docente') {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Comando solo para administradores/profesores.');
        }
        message.reply('🔄 Generando informe...');
        generateTeacherAssessment(message.channelId, (err, assessment) => {
            if (err || !assessment) return message.reply('❌ Error generando el informe.');
            const report = `📋 INFORMES DEL GRUPO (canal ${message.channelId})

👥 Participación:
${assessment.participation_summary}

📊 Regulación:
${assessment.regulation_summary}

🤝 Colaboración:
${assessment.collaboration_summary}

✨ Fortalezas:
${assessment.strengths}

💡 Mejora:
${assessment.improvement_suggestions}

📝 Global:
${assessment.overall_assessment}

(Use este informe para orientar su docencia. No es una calificación.)`;
            message.author.send(report).catch(() => message.reply('❌ No pude enviarte DM.'));
        });
        return;
    }

    // === Facilitador: solo !ayuda ===
    if (!message.content.startsWith('!ayuda')) return;

    console.log(`[AYUDA] Comando recibido de ${message.author.username} (${message.author.id}) en canal ${message.channelId}. Contenido: "${message.content}"`);

    // Metadatos de la petición
    const recentMsgs = await message.channel.messages.fetch({ limit: 20 });
    const nonBotAuthors = new Set(recentMsgs.filter(m => !m.author.bot).map(m => m.author.id));
    console.log(`[AYUDA] Participantes únicos: ${nonBotAuthors.size}, Total mensajes recientes: ${recentMsgs.size}`);
    try {
        await insertHelpRequest(message.channelId, message.author.id, nonBotAuthors.size, recentMsgs.size);
        console.log(`[AYUDA] Petición registrada en BD`);
    } catch (err) {
        console.error('[AYUDA] Error logging help request:', err);
    }

    // Barrera de cooperación
    if (nonBotAuthors.size < 3) {
        console.log(`[AYUDA] Barrera NO pasada: solo ${nonBotAuthors.size} participantes (se necesitan ≥3)`);
        return message.reply('⚠️ **Barrera:** Necesito al menos 3 miembros debatiendo. ¡Involucrad a vuestros compañeros!');
    }
    console.log(`[AYUDA] Barrera PASADA: ${nonBotAuthors.size} participantes`);

    // Obtener roles y analizar contexto
    try {
        console.log('[AYUDA] Obteniendo roles de BD...');
        const roles = await getRoles(message.channelId); 
        console.log("Roles: ", roles); 
        const rolesList = roles.map(r => `${r.username} es el ${r.role_name}`).join(', ');
        console.log(`[AYUDA] Roles asignados: ${rolesList || 'ninguno'}`);

        console.log('[AYUDA] Analizando contexto del chat...');
        const chatContext = await analyzeChatContext(message);
        console.log('[AYUDA] Contexto:', JSON.stringify(chatContext, null, 2));
        const inactiveRolesList = chatContext.functionalInactivity;

        // Modelos de acción por rol inactivo
        const actionModelsByRole = {};
        inactiveRolesList.forEach(role => {
            actionModelsByRole[role] = getActionModelsByRole(role, chatContext.conversationStage);
        });

        // Instrucciones adaptativas según diagnóstico
        let stateInstr = '';
        switch (chatContext.groupState) {
            case 'blocked': stateInstr = '⚠️ GRUPO BLOQUEADO: Ofrece procedimientos paso a paso concretos para desbloquear. Prioriza estructura, no más preguntas.'; break;
            case 'scattered': stateInstr = '⚠️ GRUPO DISPERSO: Enfócate en el Coordinador para gestione equidad. Sugiere técnicas de organización claras.'; break;
            case 'superficial_consensus': stateInstr = '⚠️ CONSENSO SUPERFICIAL: Activa al Crítico para que cuestione supuestos y pida justificaciones.'; break;
            case 'productive': stateInstr = '✅ GRUPO PRODUCTIVO: Refuerza lo que funciona y sugiere mejoras incrementales.'; break;
        }
        const qualityInstr = chatContext.ideaQuality === 'many_undecided' ? '📌 MUCHAS IDEAS SIN DECIDIR: Sugiere criterios de selección o votación estructurada.' :
                             chatContext.ideaQuality === 'few_well_justified' ? '📌 POCAS IDEAS BIEN JUSTIFICADAS: Riesgo de pensamiento grupal. Activa al Crítico.' :
                             '📌 EQUILIBRIO: Mantener ritmo, revisa que decisiones estén documentadas.';
        const levelInstr = chatContext.recommendedScaffoldingLevel === 'high' ? '🎯 NIVEL ALTO: Ofrece estructuras muy concretas. El grupo necesita guía fuerte.' :
                          chatContext.recommendedScaffoldingLevel === 'medium' ? '🎯 NIVEL MEDIO: Sugiere técnicas, deja que el grupo elija.' :
                          '🎯 NIVEL BAJO: Preguntas ligeras. No sobreestructures.';

        // Construir sugerencias contextuales
        const suggestionsText = inactiveRolesList.length > 0
            ? inactiveRolesList.map(r => `${r.toUpperCase()}: ${actionModelsByRole[r].join(' | ')}`).join('\n')
            : 'No hay roles inactivos detectados.';

        try {
            console.log('[AYUDA] Llamando a OpenAI (Groq) con modelo llama-3.3-70b-versatile...');
            const completion = await openai.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `Eres un Facilitador Cooperativo experto en andamiaje metacognitivo.

TU ROL (NO negociable):
❌ NO tutor de contenidos.
❌ NO das soluciones.
❌ NO decides por el grupo.
❌ NO evalúas.

TU FUNCIÓN:
✅ Propones ESTRATEGIAS colaborativas.
✅ Ofreces ESTRUCTURAS de pensamiento.
✅ Formulas PREGUNTAS GUIADAS contextualizadas.
✅ Sugieres PROCEDIMIENTOS para avanzar.

ESTILO: MODELOS DE ACCIÓN (no órdenes)
Al dirigirte a un rol, ofrécele MODELOS (técnicas, estructuras, enfoques), NUNCA órdenes.

📌 SECRETARIO:
- "Podrías estructurar la síntesis usando [lista de criterios | matriz | esquema causa-efecto]"
- "Una técnica: notas en tres columnas: IDEA | EVIDENCIA | DECISIÓN"
- (NUNCA escribas tú la síntesis)

📌 CRÍTICO:
- "Podrías revisar desde [coherencia lógica | solidez argumental | alternativas no consideradas]"
- "Sugiero aplicar el test de '¿Qué pasaría si...?'"
- (NUNCA formules la crítica concreta)

📌 COORDINADOR:
- "Una estrategia: dividid en subtareas independientes y asignad por interés/competencias"
- "Considerad 'timeboxing': 15 min/subproblema, luego puesta en común"
- "Podrías implementar un 'round robin': cada uno aporta una idea sin interrupciones"
- (NUNCA decidas el reparto)

🔍 CONTEXTO:
- Etapa: ${chatContext.conversationStage}
- Mensajes recientes: ${chatContext.recentMessageCount}, Autores: ${chatContext.distinctAuthors}
- Estado: ${chatContext.groupState.toUpperCase()}
- Ideas: ${chatContext.ideaQuality.toUpperCase()}
- ${stateInstr}
- ${qualityInstr}
- ${levelInstr}
- Roles inactivos: ${inactiveRolesList.join(', ') || 'ninguno'}

💡 SUGERENCIAS CONTEXTUALES (inspiración, adapta):
${suggestionsText}

📋 PRINCIPIOS:
1. Brevedad: 2-3 líneas. Español.
2. Prioriza activar roles inactivos con MODELOS DE ACCIÓN.
3. Adapta concreción al estado (ver instrucciones arriba).
4. NUNCA des contenido académico, fórmulas, datos o soluciones directas.
5. Meta: que el equipo aprenda a regularse con herramientas colaborativas.`
                    },
                    { role: "user", content: `Duda del equipo: ${message.content}` }
                ]
            });

            console.log('[AYUDA] OpenAI respondió correctamente');
            const botResponse = `🤖 **Facilitador:**\n${completion.choices[0].message.content}`;
            const interventionType = classifyIntervention(completion.choices[0].message.content);
            console.log(`[AYUDA] Tipo de intervención clasificado: ${interventionType}`);

            console.log('[AYUDA] Registrando intervención en BD...');
            await insertBotIntervention(message.channelId, interventionType);
            console.log('[AYUDA] Intervención registrada');
            message.reply(botResponse);
            console.log('[AYUDA] Respuesta enviada');
        } catch (error) {
            console.error('[AYUDA] ERROR en llamada a OpenAI:', error);
            console.error('[AYUDA] Stack trace:', error.stack);
            message.reply('⚠️ Error interno. Intenta de nuevo.');
        }
    } catch (err) {
        console.error('[AYUDA] ERROR obteniendo roles o análisis:', err);
        console.error('[AYUDA] Stack trace:', err.stack);
        message.reply('❌ Error procesando la solicitud. Asegúrate de que los roles están asignados con `/asignar_roles` y hay al menos 3 participantes.');
    }   

});

// Start chatbot
client.login(process.env.DISCORD_TOKEN);
