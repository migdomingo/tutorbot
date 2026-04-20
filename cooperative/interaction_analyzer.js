const scenarioConfig = require('../scenarios/scenario_project.js');

const ANALYSIS_SCHEMA = {
    type: "json_object",
    schema: {
        type: "object",
        properties: {
            conversationStage: {
                type: "string",
                enum: ["inicio", "desarrollo", "cierre"],
                description: "Etapa actual basada en tiempo y progreso del equipo"
            },
            groupState: {
                type: "string",
                enum: ["blocked", "scattered", "superficial_consensus", "productive"],
                description: "Estado funcional del equipo"
            },
            ideaQuality: {
                type: "string",
                enum: ["many_undecided", "few_well_justified", "balanced"],
                description: "Calidad de las decisiones tomadas"
            },
            inactiveRoles: {
                type: "array",
                items: { type: "string", enum: ["coordinator", "secretary", "critic"] },
                description: "Roles con actividad reciente insuficiente"
            },
            scaffoldingLevel: {
                type: "string",
                enum: ["high", "medium", "light"],
                description: "Nivel de andamiaje recomendado"
            },
            summary: {
                type: "string",
                description: "Breve justificación del análisis (1-2 oraciones)"
            }
        },
        required: ["conversationStage", "groupState", "ideaQuality", "inactiveRoles", "scaffoldingLevel"]
    }
};

const ANALYSIS_SYSTEM_PROMPT = `Eres un analizador de contexto colaborativo para un sistema de aprendizaje cooperativo.

Tu tarea es analizar los mensajes recientes de un equipo de estudiantes y devolver un JSON con el análisis.

DEFINICIONES:
- Etapa: inicio (<10 msgs, discutiendo qué hacer), desarrollo (10-30 msgs, trabajando), cierre (>30 msgs, cerrando)
- Estado: blocked (sin avanzar), scatterd (pocas voces), superficial_consensus (aceptan sin cuestionar), productive (bien)
- Calidad: many_undecided (sin decisiones), few_well_justified (decisiones sin rationale), balanced (adecuado)
- Roles inactivos: coordinador, secretario o crítico sin mensajes recientes
- Andamiaje: high (necesita guía fuerte), medium (sugerencias), light (ligero)

EJEMPLOS:
Input: "Hola, vamos a hacer el proyecto" | "Vale" | "De acuerdo" → {"stage": "inicio", "state": "superficial_consensus", "quality": "many_undecided", "inactive": ["coordinador","secretary","critic"], "scaffold": "medium"}
Input: "Hemos fait el análisis" | "Bien" | "Ahora hacemos la presentación" | "Ok" → {"stage": "desarrollo", "state": "productive", "quality": "balanced", "inactive": [], "scaffold": "light"}

Responde SOLO con JSON válido, sin texto adicional.`;

/**
 * Analyze chat context using LLM with structured output
 * Primary analysis method with keyword fallback
 */
async function analyzeChatContext(message, openai = null) {
    const defaultAnalysis = {
        recentMessageCount: 0,
        distinctAuthors: 0,
        activeRoles: { coordinator: false, secretary: false, critic: false },
        conversationStage: scenarioConfig.conversationStages.labels.inicio,
        groupState: scenarioConfig.groupStates.productive.name,
        ideaQuality: scenarioConfig.ideaQuality.balanced.name,
        functionalInactivity: [],
        recommendedScaffoldingLevel: scenarioConfig.scaffoldingLevels.light.name
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

        defaultAnalysis.recentMessageCount = msgsArray.length;
        defaultAnalysis.distinctAuthors = new Set(msgsArray.map(m => m.author.id)).size;

        if (openai) {
            try {
                const chatMessages = msgsArray.slice(0, 10).map(m => `${m.author.username}: ${m.content}`).join('\n');
                
                const completion = await openai.chat.completions.create({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
                        { role: "user", content: `Analiza:\n${chatMessages}\n\nResponde con JSON.` }
                    ],
                    temperature: 0.1,
                    max_completion_tokens: 500,
                    response_format: ANALYSIS_SCHEMA
                }, { timeout: 8000 });

                const responseText = completion.choices[0]?.message?.content;
                if (responseText) {
                    const llmAnalysis = JSON.parse(responseText);
                    console.log('[ANALYZER] LLM análisis:', llmAnalysis);
                    
                    return {
                        recentMessageCount: defaultAnalysis.recentMessageCount,
                        distinctAuthors: defaultAnalysis.distinctAuthors,
                        activeRoles: defaultAnalysis.activeRoles,
                        conversationStage: llmAnalysis.conversationStage || defaultAnalysis.conversationStage,
                        groupState: llmAnalysis.groupState || defaultAnalysis.groupState,
                        ideaQuality: llmAnalysis.ideaQuality || defaultAnalysis.ideaQuality,
                        functionalInactivity: llmAnalysis.inactiveRoles || [],
                        recommendedScaffoldingLevel: llmAnalysis.scaffoldingLevel || defaultAnalysis.recommendedScaffoldingLevel,
                        _llmSummary: llmAnalysis.summary
                    };
                }
            } catch (llmErr) {
                console.error('[ANALYZER] LLM error, usando fallback keywords:', llmErr.message);
            }
        }

        return analyzeChatContextKeywords(message, msgsArray, defaultAnalysis);
    } catch (e) {
        console.error('[ANALYZER] Context analysis error:', e);
        return defaultAnalysis;
    }
}

/**
 * Fallback: Keyword-based analysis (original method)
 */
function analyzeChatContextKeywords(message, msgsArray, baseAnalysis) {
    const analysis = { ...baseAnalysis };

    try {
        const roleMsgCount = { coordinator: 0, secretary: 0, critic: 0 };
        msgsArray.forEach(m => {
            const u = m.author.username.toLowerCase();
            const c = m.content.toLowerCase();
            if (u.includes('coord') || u.includes('scrum') || c.includes('coordinador')) { analysis.activeRoles.coordinator = true; roleMsgCount.coordinator++; }
            if (u.includes('secre') || u.includes('escriba') || c.includes('secretario')) { analysis.activeRoles.secretary = true; roleMsgCount.secretary++; }
            if (u.includes('critico') || u.includes('portavoz') || c.includes('crítico')) { analysis.activeRoles.critic = true; roleMsgCount.critic++; }
        });

        const { thresholds } = scenarioConfig.conversationStages;
        if (analysis.recentMessageCount <= thresholds.inicio) {
            analysis.conversationStage = scenarioConfig.conversationStages.labels.inicio;
        } else if (analysis.recentMessageCount <= thresholds.desarrollo) {
            analysis.conversationStage = scenarioConfig.conversationStages.labels.desarrollo;
        } else {
            analysis.conversationStage = scenarioConfig.conversationStages.labels.cierre;
        }

        const progressIndicators = msgsArray.filter(m => /hecho|listo|avanzad|terminad|complet|siguiente|paso|siguiendo|avance/.test(m.content)).length;
        const questionIndicators = msgsArray.filter(m => /\?|cómo|qué|cuál|dónde|cuándo|por qué/.test(m.content)).length;

        if (analysis.recentMessageCount >= 15 && progressIndicators === 0 && questionIndicators > 5) analysis.groupState = scenarioConfig.groupStates.blocked.name;
        else if (analysis.distinctAuthors < 3 && analysis.recentMessageCount > 10) analysis.groupState = scenarioConfig.groupStates.scattered.name;
        else if (questionIndicators < 2 && progressIndicators > analysis.recentMessageCount * 0.6) analysis.groupState = scenarioConfig.groupStates.superficial_consensus.name;
        else analysis.groupState = scenarioConfig.groupStates.productive.name;

        const decisionIndicators = msgsArray.filter(m => /decidimos|elegimos|votamos|acordamos|quedamos en/.test(m.content)).length;
        const justificationIndicators = msgsArray.filter(m => /porque|ya que|dado que|debido a|justifica|razón/.test(m.content)).length;

        if (decisionIndicators === 0 && analysis.recentMessageCount > 10) analysis.ideaQuality = scenarioConfig.ideaQuality.many_undecided.name;
        else if (decisionIndicators > 0 && justificationIndicators < decisionIndicators * 0.5) analysis.ideaQuality = scenarioConfig.ideaQuality.few_well_justified.name;
        else analysis.ideaQuality = scenarioConfig.ideaQuality.balanced.name;

        if (analysis.conversationStage === 'desarrollo' || analysis.conversationStage === 'cierre') {
            if (!analysis.activeRoles.coordinator && roleMsgCount.coordinator === 0) analysis.functionalInactivity.push('coordinator');
            if (!analysis.activeRoles.secretary && roleMsgCount.secretary === 0) analysis.functionalInactivity.push('secretary');
            if (!analysis.activeRoles.critic && roleMsgCount.critic === 0) analysis.functionalInactivity.push('critic');
        }

        if (analysis.groupState === 'blocked' || analysis.functionalInactivity.length >= 2) analysis.recommendedScaffoldingLevel = scenarioConfig.scaffoldingLevels.high.name;
        else if (analysis.groupState === 'scattered' || analysis.functionalInactivity.length === 1) analysis.recommendedScaffoldingLevel = scenarioConfig.scaffoldingLevels.medium.name;
        else analysis.recommendedScaffoldingLevel = scenarioConfig.scaffoldingLevels.light.name;

    } catch (e) { console.error('[ANALYZER] Keyword fallback error:', e); }
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

module.exports = {
    analyzeChatContext,
    classifyIntervention
};