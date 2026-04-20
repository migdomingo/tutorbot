/**
 * Help Command Handler - Facilitador Cooperativo
 * Módulo independiente para el comando !ayuda
 * Implementa andamiaje metacognitivo con estrategias de desbloqueo y variación
 */

const { analyzeChatContext, classifyIntervention } = require('./interaction_analyzer.js');
const { 
    getRoles, 
    insertHelpRequest, 
    insertBotIntervention, 
    getRecentSuggestions, 
    recordSuggestion 
} = require('./cooperative_db.js');
const scenarioConfig = require('../scenarios/scenario_project.js');

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
 * Main handler for !ayuda command
 */
async function handleHelpCommand(message, openai) {
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
                    content: `Eres un Facilitador Cooperativo experto en andamiaje metacognitivo.

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
 - Dirígete a los miembros POR SU NOMBRE DE USUARIO, mencionando su rol (ej. "Juan, como Coordinador, ¿cómo...?", "María, como Secretaria, ¿qué estructura...?")
 - Usa PREGUNTAS abiertas, no afirmaciones prescriptivas.
 - Ofrece OPCIONES entre las que elegir (2-3), nunca una única solución.
 - Ejemplo CORRECTO: "María, como Secretaria, ¿qué estructura os parece más útil: lista de criterios, matriz o esquema causa-efecto?"
 - Ejemplo INCORRECTO: "Secretario, usa una matriz de criterios."
 - Si un rol está inactivo, menciónalo POR SU NOMBRE y pregúntale por su función específica.

 TONO DE COMUNICACIÓN:
 - Usa tuteo (tratamiento "tú", no "usted").
 - Sé cercano, respetuoso y colaborativo.
 - Nunca suenes paternalista ("deberíais...", "tenéis que...") ni evaluador ("bien", "mal", "correcto").
 - Habla como un profesor que acompaña, no como un experto que sabe más.
 - Usa un español de España (es-ES), natural y coloquial pero apropiado para el aula.

 📋 PRINCIPIOS (obedécelos SIEMPRE):
1. Brevedad: 2-4 líneas máximo. Idioma: español de España (es-ES).
2. Ofrece ALTERNATIVAS y deja que el equipo elija.
3. NUNCA des contenido académico, fórmulas, datos concretos o soluciones directas.
4. La meta es que el equipo APRENDA A REGULARSE, no que dependa de ti.
5. Pregunta, no digas. Propón opciones, no prescribas.

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

📝 FORMATO DE RESPUESTA:
1. Breve reconocimiento del estado (1 línea, ej. "Veo que estáis en etapa de planificación").
2. 2-3 preguntas dirigidas a roles específicos (usa los nombres de usuario reales).
3. Si hay roles inactivos, MENCIÓNALOS EXPRESAMENTE por su nombre para activarlos.
4. NUNCA des pasos concretos o instrucciones de "cómo hacer".`
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
    handleHelpCommand
};
