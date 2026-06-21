/**
 * Help Command Handler - Facilitador colaborativo
 * Módulo independiente para el comando !ayuda
 * Implementa andamiaje metacognitivo con estrategias de desbloqueo y variación
 */

const { analyzeChatContext, classifyIntervention } = require('./interaction_analyzer.js');
const {
    getRoles,
    insertHelpRequest,
    insertBotIntervention,
    getRecentSuggestions,
    recordSuggestion,
    getRecentMessagesWithRoleMentions,
    getLastBotIntervention,
    getUsersParticipatedSince,
    dbAll
} = require('../commons/db.js');
const scenarioConfig = require('./scenario_configuration.js');

/**
 * Check whether all role members have participated since the last bot intervention.
 * Implements scenarioConfig.interventionPolicy.minMessagesBetweenInterventions.
 * Returns { allowed: bool, pendingUsers: string[] }
 */
async function checkParticipationSinceLastIntervention(channelId) {
    const last = await getLastBotIntervention(channelId);
    if (!last) return { allowed: true, pendingUsers: [] };

    const roles = await getRoles(channelId);
    if (!roles || roles.length === 0) return { allowed: true, pendingUsers: [] };

    const activeSince = await getUsersParticipatedSince(channelId, last.timestamp);
    const activeIds = new Set(activeSince.map(r => r.user_id));

    // Find role members who have NOT sent any message since then
    const pendingUsers = roles
        .filter(r => !activeIds.has(r.user_id))
        .map(r => r.username);

    return {
        allowed: pendingUsers.length === 0,
        pendingUsers
    };
}

/**
 * Get varied suggestions for a role, avoiding recent repetitions
 * Selects 2 questions not used recently in this channel
 */
async function getVariedSuggestionsForRole(role, stage, channelId) {
    // Get all questions for this role/stage from scenario config
    const allQuestions = scenarioConfig.roleQuestions[role]?.[stage] || 
                        ["¿Cómo podrías aportar más valor desde tu rol en esta etapa?"];
    
    // Get recent suggestions for this role in this channel (last 3)
    const recent = await getRecentSuggestions(channelId, role, 3);
    const recentTexts = recent.map(r => r.suggestion_text);
    
    // Filter out recently used questions
    const available = allQuestions.filter(q => !recentTexts.includes(q));
    
    // If we have enough new questions, pick 2 random new ones
    let selected = [];
    if (available.length >= 2) {
        selected = available.sort(() => 0.5 - Math.random()).slice(0, 2);
    } else {
        // If few new ones available, use all new ones and complement with unused from all
        selected = available.slice(0);
        const remainingFromAll = allQuestions.filter(q => !selected.includes(q));
        const needMore = 2 - selected.length;
        selected = selected.concat(
            remainingFromAll.sort(() => 0.5 - Math.random()).slice(0, needMore)
        );
    }
    
    // Record the selected suggestions to avoid future repetition
    for (const q of selected) {
        await recordSuggestion(channelId, role, q);
    }
    
    return selected;
}

/**
  * Verifica activación flexible para contexto presencial
  * Condiciones: multi_participant_chat | functional_trace | teacher_override
  */
async function checkFlexibleActivation(message) {
    const recentMsgs = await message.channel.messages.fetch({ limit: 20 });
    const nonBotMsgs = recentMsgs.filter(m => !m.author.bot);
    const nonBotAuthors = new Set(nonBotMsgs.map(m => m.author.id));
    
    // A) Multi-participante: ≥3 autores distintos
    if (nonBotAuthors.size >= 3) {
        return {
            activationReason: 'multi_participant_chat',
            participantsDetected: nonBotAuthors.size,
            rolesDetected: [],
            messageCount: nonBotMsgs.size
        };
    }
    
    // B) Traza funcional: secretario + otro rol
    // Verificar en participación log si existen mensajes de roles distintos
    const roles = await getRoles(message.channelId);
    const roleUserIds = {};
    roles.forEach(r => {
        roleUserIds[r.user_id] = r.role_name;
    });
    
    const secretaryId = roles.find(r => r.role_name.includes('Secretar'))?.user_id;
    const nonSecretaryRoleIds = roles.filter(r => !r.role_name.includes('Secretar')).map(r => r.user_id);
    
    // Contar mensajes de participantes con roles
    const msgAuthors = nonBotMsgs.map(m => m.author.id);
    const hasSecretaryMsg = secretaryId && msgAuthors.includes(secretaryId);
    const hasOtherRoleMsg = nonSecretaryRoleIds.some(id => id && msgAuthors.includes(id));
    
    if (hasSecretaryMsg && hasOtherRoleMsg) {
        const rolesDetected = roles.map(r => {
            if (r.user_id === secretaryId) return 'secretary';
            if (r.role_name.includes('Coordinad')) return 'coordinator';
            if (r.role_name.includes('Portavoz') || r.role_name.includes('Crítico')) return 'critic';
            return 'unknown';
        }).filter(r => r !== 'unknown');
        
        return {
            activationReason: 'functional_trace',
            participantsDetected: nonBotAuthors.size,
            rolesDetected: rolesDetected,
            messageCount: nonBotMsgs.size
        };
    }
    
    // No se cumple ninguna condición
    return {
        activationReason: null,
        participantsDetected: nonBotAuthors.size,
        rolesDetected: [],
        messageCount: nonBotMsgs.size
    };
}

/**
  * Main handler for !ayuda command
  */
async function handleHelpCommand(message, openai, forceOverride = false) {
    console.log(`[AYUDA] Comando recibido de ${message.author.username} (${message.author.id}) en canal ${message.channelId}. Contenido: "${message.content}"`);
    
    const recentMsgs = await message.channel.messages.fetch({ limit: 20 });
    const nonBotAuthors = new Set(recentMsgs.filter(m => !m.author.bot).map(m => m.author.id));

    let activation;
    
    // C) Override del docente: forzar intervención
    if (forceOverride) {
        activation = {
            activationReason: 'teacher_override',
            participantsDetected: nonBotAuthors.size,
            rolesDetected: [],
            messageCount: recentMsgs.size
        };
        console.log(`[AYUDA] Activado por override del docente`);
    } else {
        activation = await checkFlexibleActivation(message);
    }
    
    // Registrar en BD con metadatos completos
    try {
        await insertHelpRequest(
            message.channelId, 
            message.author.id, 
            activation.participantsDetected, 
            activation.messageCount,
            activation.activationReason,
            JSON.stringify(activation.rolesDetected)
        );
        console.log(`[AYUDA] Petición registrada: ${activation.activationReason}`);
    } catch (err) {
        console.error('[AYUDA] Error logging help request:', err);
    }

    // Verificar si se cumple alguna condición de activación
    if (!activation.activationReason) {
        console.log(`[AYUDA] ACTIVACIÓN RECHAZADA: ${activation.participantsDetected} participantes`);

        let rejectionMsg = '⚠️ **Activación pendiente:**\n\n';
        rejectionMsg += 'Para activar el facilitador, se necesita:\n';
        rejectionMsg += '• Al menos 3 participantes en el chat, O\n';
        rejectionMsg += '• Al menos 1 mensaje del Secretario/a Y 1 de otro rol.\n\n';
        rejectionMsg += 'El docente puede forzar intervención con `/forzar_ayuda`.';

        return message.reply(rejectionMsg);
    }
    console.log(`[AYUDA] ACTIVACIÓN ACEPTADA: ${activation.activationReason}`);

    // Verificar que todos los miembros han participado desde la última intervención
    if (!forceOverride) {
        const participation = await checkParticipationSinceLastIntervention(message.channelId);
        if (!participation.allowed) {
            console.log(`[AYUDA] BLOQUEADO por política de participación. Pendientes: ${participation.pendingUsers.join(', ')}`);
            const names = participation.pendingUsers.join(', ');
            return message.reply(
                `⏳ Aún no puedo intervenir: **${names}** no ha/n participado en el chat desde la última vez que ayudé.\n` +
                `Reflexionad, compartid vuestras ideas, y luego volvéis a pedir ayuda. 💬`
            );
        }
    }

    // Análisis y generación de respuesta
    try {
        console.log('[AYUDA] Obteniendo roles de BD...');
        const roles = await getRoles(message.channelId); 
        console.log("Roles: ", roles); 
        const rolesList = roles.map(r => `${r.username} es el ${r.role_name}`).join(', ');
        console.log(`[AYUDA] Roles asignados: ${rolesList || 'ninguno'}`);

        console.log('[AYUDA] Analizando contexto del chat (LLM + keywords fallback)...');
        const chatContext = await analyzeChatContext(message, openai);
        console.log('[AYUDA] Contexto:', JSON.stringify(chatContext, null, 2));
        const inactiveRolesList = chatContext.functionalInactivity;

        // Modelos de acción por rol inactivo con variación (evita repeticiones)
        const actionModelsByRole = {};
        for (const role of inactiveRolesList) {
            actionModelsByRole[role] = await getVariedSuggestionsForRole(role, chatContext.conversationStage, message.channelId);
        }

        // Construir sugerencias contextuales
        const suggestionsContext = inactiveRolesList.length > 0
            ? inactiveRolesList.map(r => 
                `${r.toUpperCase()}: Posibles enfoques:\n` + 
                actionModelsByRole[r].join('\n')
              ).join('\n\n')
            : 'No hay roles inactivos detectados. El equipo está funcionando bien en cuanto a distribución de responsabilidades.';

        // Estrategias de desbloqueo para estados no productivos (CON VARIACIÓN)
        if (chatContext.groupState === 'blocked' || chatContext.groupState === 'scattered' || chatContext.groupState === 'superficial_consensus') {
            const allUnblockingStrategies = [
                "¿Habéis considerado dividir el problema en partes más pequeñas y abordar una a una?",
                "¿Qué tal si generáis varias opciones sin decidir todavía?",
                "¿Os serviría un criterio temporal (por ejemplo, 'decidimos en 10 minutos') para avanzar?",
                "¿Podríais reformular la pregunta inicial para asegurar que todos entendéis el objetivo?",
                "¿Habéis pensado en priorizar las ideas antes de elegir una?"
            ];
            
            // Obtener estrategias de desbloqueo ya usadas recientemente en este canal (rol 'general')
            const recentGeneral = await getRecentSuggestions(message.channelId, 'general', 2);
            const recentGeneralTexts = recentGeneral.map(r => r.suggestion_text);
            
            // Filtrar y seleccionar 2-3 no usadas
            const available = allUnblockingStrategies.filter(s => !recentGeneralTexts.includes(s));
            let selectedUnblocking = [];
            if (available.length >= 3) {
                selectedUnblocking = available.sort(() => 0.5 - Math.random()).slice(0, 3);
            } else {
                selectedUnblocking = available.slice(0);
                const remaining = allUnblockingStrategies.filter(s => !selectedUnblocking.includes(s));
                const need = 3 - selectedUnblocking.length;
                selectedUnblocking = selectedUnblocking.concat(
                    remaining.sort(() => 0.5 - Math.random()).slice(0, need)
                );
            }
            
            // Registrar las seleccionadas
            for (const s of selectedUnblocking) {
                await recordSuggestion(message.channelId, 'general', s);
            }
            
            suggestionsContext += '\n\nESTRATEGIAS DE DESBLOQUEO (sugiere alguna COMO OPCIÓN):\n' + 
                selectedUnblocking.map(s => `- ${s}`).join('\n');
        }

        // Instrucciones adaptativas según diagnóstico
        let stateInstr = '';
        switch (chatContext.groupState) {
            case 'blocked': 
                stateInstr = 'GRUPO BLOQUEADO: Prioriza estrategias de desbloqueo (dividir problema, generar opciones, criterio temporal, reformular pregunta, priorizar). Ofrécelas como preguntas, no como órdenes.'; 
                break;
            case 'scattered': 
                stateInstr = 'GRUPO DISPERSO: Usa estrategias de reorganización (reparto claro, timeboxing, rondas de turnos). Dirígete al COORDINADOR para que gestione enfoque y equidad.'; 
                break;
            case 'superficial_consensus': 
                stateInstr = 'CONSENSO SUPERFICIAL: Usa estrategias de profundización (cuestionar supuestos, pedir justificaciones, buscar alternativas). Activa al CRÍTICO.'; 
                break;
            case 'productive': 
                stateInstr = 'GRUPO PRODUCTIVO: Refuerza lo que funciona y sugiere mejoras incrementales con preguntas. Mantén el ritmo.'; 
                break;
        }
        
        let qualityInstr = '';
        if (chatContext.ideaQuality === 'many_undecided') {
            qualityInstr = 'Hay muchas ideas sin decidir. Ayuda al equipo a establecer CRITERIOS DE SELECCIÓN, no elijas por ellos.';
        } else if (chatContext.ideaQuality === 'few_well_justified') {
            qualityInstr = 'Pocas ideas bien justificadas. Riesgo de pensamiento grupal. Pide al CRÍTICO que cuestione y busque alternativas.';
        } else {
            qualityInstr = 'Equilibrio bueno. Revisa que las decisiones estén documentadas y el avance es claro.';
        }

        let levelInstr = '';
        if (chatContext.recommendedScaffoldingLevel === 'high') {
            levelInstr = 'NIVEL ALTO: El grupo necesita guía fuerte. Ofrece estructuras muy concretas COMO OPCIONES entre las que elegir, no como órdenes.';
        } else if (chatContext.recommendedScaffoldingLevel === 'medium') {
            levelInstr = 'NIVEL MEDIO: Sugiere técnicas y deja que el equipo elija qué implementar.';
        } else {
            levelInstr = 'NIVEL BAJO: Preguntas ligeras para mantener el ritmo. No sobreestructures.';
        }

        // Llamada a OpenAI
        console.log('[AYUDA] Llamando a OpenAI (Groq) con modelo llama-3.3-70b-versatile...');
        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `Eres un Facilitador colaborativo experto en andamiaje metacognitivo.

TU ROL (NO negociable):
❌ NO tutor de contenidos académicos.
❌ NO das soluciones a la tarea.
❌ NO decides por el grupo.
❌ NO evalúas ni puntúas.
❌ NUNCA escribas tú la síntesis, crítica o planificación.

TU FUNCIÓN:
✅ Ofreces MODELOS DE ACCIÓN (estrategias, estructuras, procedimientos) como opciones.
✅ Formulas PREGUNTAS GUIADAS que ayuden al equipo a autorregularse.
✅ Activas a los roles inactivos dirigiéndote a ellos POR SU NOMBRE DE USUARIO.
✅ Adaptas tu feedback al contexto (etapa, estado, calidad de ideas).

ESTILO OBLIGATORIO:
 - Dirígete a cada alumno/a POR SU NOMBRE, sin mencionar el nombre del rol (no digas "como Coordinador"; simplemente usa el nombre).
 - Haz UNA sola pregunta corta por alumno/a. Máximo una frase por persona.
 - Las preguntas deben ser CONCRETAS y fáciles de responder: sobre qué están haciendo ahora, qué no entienden, o cuál sería su próximo paso.
 - Ejemplo CORRECTO: "Ana, ¿en qué parte del trabajo os habéis quedado atascados?"
 - Ejemplo CORRECTO: "Pedro, ¿hay algo del enunciado que no os haya quedado claro?"
 - Ejemplo INCORRECTO: "María, como Secretaria, ¿qué estructura de documentación os parece más adecuada para registrar vuestros avances?"
 - Si un rol está inactivo, hazle UNA pregunta directa y sencilla por su nombre.

TONO DE COMUNICACIÓN:
 - Habla como un compañero/a mayor o un profe joven, cercano y directo.
 - Tuteo siempre. Frases cortas. Sin palabras raras ni tecnicismos.
 - NUNCA uses palabras como: andamiaje, metacognición, estructura, documentar, estrategia, recurso, objetivo, priorizar.
 - Nada de frases largas ni acumulación de opciones. Una pregunta simple y directa.
 - Español de España (es-ES), coloquial de aula y utilizando la segunda persona del plural (vosotros).

📋 PRINCIPIOS (obedécelos SIEMPRE):
1. Una pregunta por alumno/a. Máximo 1 frase por persona.
2. Preguntas concretas: "¿qué no entendéis?", "¿por dónde empezaríais?", "¿en qué estáis ahora?".
3. NUNCA des contenido académico, fórmulas, datos concretos o soluciones directas.
4. La meta es que el equipo siga adelante solo, no que dependa de ti.
5. Pregunta, no expliques.

🔍 CONTEXTO DEL GRUPO (consúltalo para adaptar):
- Etapa: ${chatContext.conversationStage}
- Mensajes recientes: ${chatContext.recentMessageCount}, Autores distintos: ${chatContext.distinctAuthors}
- Estado del grupo: ${chatContext.groupState.toUpperCase()}
- Calidad de ideas: ${chatContext.ideaQuality.toUpperCase()}
- Nivel de andamiaje recomendado: ${chatContext.recommendedScaffoldingLevel.toUpperCase()}
- Roles inactivos detectados: ${inactiveRolesList.join(', ') || 'ninguno'}

🎯 INSTRUCCIONES ADAPTATIVAS (sigue según estado):
${stateInstr}
${qualityInstr}
${levelInstr}

💡 MODELOS DE ACCIÓN SUGERIDOS (inspiración para tus preguntas - ADAPTALOS al contexto real):
${suggestionsContext}

📝 FORMATO DE RESPUESTA (sígelo al pie de la letra):
- Una línea corta de introducción (opcional, máximo 1 frase sencilla).
- Después, UNA línea por alumno/a, separadas por salto de línea en blanco.
- Cada línea: "[Nombre], [pregunta directa y corta]?"
- Ejemplo de formato correcto:

Parece que estáis un poco parados, ¡vamos a desatascarlo!

Ana, ¿en qué parte del trabajo os habéis quedado atascados?

Pedro, ¿hay algo del enunciado que no entendéis del todo?

Lucía, si tuvierais que empezar por algo ahora mismo, ¿qué sería?

- NUNCA pongas todo seguido en un solo párrafo.
- NUNCA des pasos concretos ni instrucciones de "cómo hacer".`
                },
                { role: "user", content: `El equipo ha escrito: "${message.content}"\n\nRoles asignados en este canal: ${rolesList || 'Aún no se han asignado roles con /asignar_roles'}.\n\nUsa los nombres de los miembros cuando te dirijas a ellos. Cuando un rol está inactivo, dirígete a ese miembro por su nombre de usuario.` }
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
    } catch (err) {
        console.error('[AYUDA] ERROR obteniendo roles o análisis:', err);
        console.error('[AYUDA] Stack trace:', err.stack);
        message.reply('❌ Error procesando la solicitud. Asegúrate de que los roles están asignados con `/asignar_roles` y hay al menos 3 participantes.');
    }   
}

module.exports = {
    handleCollaborativeHelpCommand: handleHelpCommand
};
