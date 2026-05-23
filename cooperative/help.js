/**
 * Cooperative Help Command Handler
 * --------------------------------
 * Uses cooperative interaction analyzer to manage
 * structured cooperative learning processes.
 */

const scenarioConfig = require('./scenario_configuration.js');
const { analyzeCooperativeContext } = require('./interaction_analyzer.js');

const {
  getRoles,
  insertHelpRequest,
  insertBotIntervention,
  getActivityContext,
  getLastAutomaticIntervention
} = require('../commons/db.js');

const AUTOMATIC_INTERVENTION_COOLDOWN_MINUTES = 10;

/**
 * Helper: map role id to display name
 */
function label(roleId) {
  return scenarioConfig.roles[roleId]?.displayName || roleId;
}

/**
 * Generate response based on cooperative analysis, activity context and strict rules using LLM
 */
async function generateCooperativeResponse(context, roles, activityContext, openai, isAutomatic = false) {
  const prompt = `Eres un GESTOR DEL PROCESO COOPERATIVO.
Tu función es hacer PREGUNTAS DE VERIFICACIÓN DE PROCESO para asegurar la organización.

CONTEXTO DECLARADO POR EL DOCENTE (NO INFIERAS NINGÚN OTRO):
- Dominio: ${activityContext.domain}
- Tema: ${activityContext.topic}
- Tipo de tarea: ${activityContext.task_type}
- Partes Requeridas: ${activityContext.required_parts.join(', ')}
- Mapeo de Roles a Tareas: ${JSON.stringify(activityContext.role_mapping)}

ESTADO DEL GRUPO (Analizado por el sistema):
- Fase actual (según participación): ${context.phase.toUpperCase()}
- Roles activos: ${context.activeRoles.join(', ') || 'Ninguno'}
- Roles inactivos: ${context.inactiveRoles.join(', ') || 'Ninguno'}
- Miembros y sus roles: ${roles.map(r => `${r.username} (${r.role_name})`).join(', ')}
${isAutomatic ? 'TIPO DE INTERVENCIÓN: Intervención automática de seguimiento (Milestone).' : 'TIPO DE INTERVENCIÓN: Petición de ayuda directa de los usuarios (!ayuda).'}

RESTRICCIONES ABSOLUTAS Y NO NEGOCIABLES:
❌ NO expliques conceptos de la materia.
❌ NO corrijas errores conceptuales o técnicos.
❌ NO valides o invalides respuestas.
❌ NO proporciones ejemplos disciplinarios.
❌ NO evalúes al alumnado o al grupo.
❌ NO sustituyas decisiones del grupo ("haced esto", "debéis organizarlo así").
❌ NO infieras comprensión cognitiva ("parece que no entendéis").

LO QUE SÍ PUEDES HACER:
✅ Preguntar por la estructura del trabajo.
✅ Preguntar por el reparto de responsabilidades (usando el Mapeo de Roles).
✅ Preguntar por las Fases.
✅ Preguntar explícitamente a los roles inactivos si están avanzando en sus partes asiganadas.
✅ Usar los NOMBRES DE USUARIO para dirigirte a ellos.

FORMATO:
Haz 1 o 2 preguntas breves dirigidas a los usuarios correspondientes. Se breve (2-3 líneas max). Tono de profesor observador.`;

  try {
      const completion = await openai.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
              { role: "system", content: prompt },
              { role: "user", content: "Genera la intervención organizativa basándote extrictamente en el contexto de las partes declaradas y el estado de los roles." }
          ]
      });
      return completion.choices[0].message.content;
  } catch (err) {
      console.error('[COOP_HELP] Error llamando a OpenAI:', err);
      return "⚠️ Error al generar la ayuda cooperativa. Continuad con vuestras tareas asignadas.";
  }
}

/**
 * Main entry point for cooperative !ayuda
 */
async function handleCooperativeHelpCommand(message, openai, forceOverride = false) {
  console.log(
    `[COOP_HELP] !ayuda en canal ${message.channelId} por ${message.author.username}`
  );

  const mode = 'cooperative';
  // 1. Log help request
  await insertHelpRequest(
    message.channelId,
    message.author.id,
    0,
    0,
    'user_request',
    JSON.stringify([]),
    mode
  );

  // 2. Get activityContext
  const activityContext = await getActivityContext(message.channelId);
  if (!activityContext) {
    return message.reply(
      '⚠️ El docente aún no ha configurado la actividad. Espera a que se defina el contexto de trabajo.'
    );
  }

  // 3. Load roles
  const roles = await getRoles(message.channelId);
  if (!roles || roles.length === 0) {
    return message.reply(
      '⚠️ No hay roles asignados. Usa primero `/asignar_roles`.'
    );
  }

  // 4. Analyze cooperative context
  const context = await analyzeCooperativeContext(message, roles);
  console.log('[COOP_ANALYZER]', context);

  // 5. Generate dynamic response via LLM based on activityContext
  const response = await generateCooperativeResponse(context, roles, activityContext, openai, false);

  // 6. Log bot intervention
  if (response.trim().length > 0) {
    await insertBotIntervention(
      message.channelId,
      'coordination',
      mode
    );
    return message.reply(`🤖 **Gestor Cooperativo:**\n${response}`);
  }

  return message.reply(
    'ℹ️ El proceso parece en marcha. Continuad con las tareas asignadas.'
  );
}

/**
 * Automatic intervention based on cooperative process milestones
 * Triggered only when allowed by configuration and analyzer
 */
async function handleAutomaticMilestoneIntervention(message, roles, openai) {
  // Seguridad: solo si está permitido por configuración
  if (!scenarioConfig.automatic_interventions_enabled) return;

  // Cooldown: evitar intervenciones repetidas en poco tiempo
  const lastIntervention = await getLastAutomaticIntervention(message.channelId);
  if (lastIntervention) {
    const minutesSince = (Date.now() - new Date(lastIntervention.timestamp).getTime()) / 60000;
    if (minutesSince < AUTOMATIC_INTERVENTION_COOLDOWN_MINUTES) return;
  }

  // Obtener contexto de actividad. Si no existe, no intervenir
  const activityContext = await getActivityContext(message.channelId);
  if (!activityContext) return;

  // Obtener contexto cooperativo
  const context = await analyzeCooperativeContext(message, roles);

  // El analizador decide si tiene sentido intervenir
  if (!context.automaticInterventionRecommended) return;

  // Llamar al LLM para la intervención
  const response = await generateCooperativeResponse(context, roles, activityContext, openai, true);

  if (!response || response.trim().length === 0 || response.includes('Error')) return;

  // Log de intervención automática
  await insertBotIntervention(
    message.channelId,
    'automatic_milestone',
    'cooperative'
  );

  // Enviar mensaje
  return message.channel.send(`🤖 **Gestor Cooperativo [Automático]:**\n${response}`);
}

module.exports = {
  handleCooperativeHelpCommand,
  handleAutomaticMilestoneIntervention
};