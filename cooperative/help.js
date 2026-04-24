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
  insertBotIntervention
} = require('../commons/db.js');

/**
 * Helper: map role id to display name
 */
function label(roleId) {
  return scenarioConfig.roles[roleId]?.displayName || roleId;
}

/**
 * Build response based on cooperative analysis and policy
 */
function buildCooperativeResponse(context, roles) {
  const lines = [];

  console.log(`[COOP_BUILD_RESPONSE] Building response for context:`, {
    phase: context.phase,
    inactiveRoles: context.inactiveRoles,
    processIssues: context.processIssues,
    allowedInterventions: scenarioConfig.allowed_interventions
  });

  // ──────────────────────────────────────────
  // 1. Coordination checks
  // ──────────────────────────────────────────
  if (
    scenarioConfig.allowed_interventions.includes('coordination') &&
    context.inactiveRoles.includes('coordinator')
  ) {
    const coord = roles.find(r => r.role_name === 'coordinator');
    if (coord) {
      const message = `${coord.username}, como ${label('coordinator')}, ¿tienes claro si todas las tareas están repartidas y en marcha?`;
      lines.push(message);
      console.log(`[COOP_BUILD_RESPONSE] Added coordination message for ${coord.username}: "${message}"`);
    }
  }

  // ──────────────────────────────────────────
  // 2. Task management checks
  // ──────────────────────────────────────────
  if (
    scenarioConfig.allowed_interventions.includes('task_management')
  ) {
    const taskRoles = roles.filter(r =>
      r.role_name.startsWith('task')
    );
    taskRoles.forEach(r => {
      if (context.inactiveRoles.includes(r.role_name)) {
        const message = `${r.username}, ¿tu parte (${label(r.role_name)}) está completada o pendiente de ajuste?`;
        lines.push(message);
        console.log(`[COOP_BUILD_RESPONSE] Added task management message for ${r.username}: "${message}"`);
      }
    });
  }

  // ──────────────────────────────────────────
  // 3. Review / integration checks
  // ──────────────────────────────────────────
  if (
    scenarioConfig.allowed_interventions.includes('review_checks') &&
    (context.phase === 'revision' || context.phase === 'cierre')
  ) {
    const supervisor = roles.find(r => r.role_name === 'supervisor');
    if (supervisor && context.inactiveRoles.includes('supervisor')) {
      const message = `${supervisor.username}, como ${label('supervisor')}, ¿alguien está revisando que todas las partes encajen antes de entregar?`;
      lines.push(message);
      console.log(`[COOP_BUILD_RESPONSE] Added review check message for ${supervisor.username}: "${message}"`);
    }
  }

  // Limit output length strictly
  const finalLines = lines.slice(0, 3);
  console.log(`[COOP_BUILD_RESPONSE] Final response (${finalLines.length} lines):`, finalLines.join('\n'));
  return finalLines.join('\n');
}

/**
 * Build response based on cooperative analysis and policy
 */
function buildCooperativeResponse(context, roles) {
  const lines = [];

  // ──────────────────────────────────────────
  // 1. Coordination checks
  // ──────────────────────────────────────────
  if (
    scenarioConfig.allowed_interventions.includes('coordination') &&
    context.inactiveRoles.includes('coordinator')
  ) {
    const coord = roles.find(r => r.role_name === 'coordinator');
    if (coord) {
      lines.push(
        `${coord.username}, como ${label('coordinator')}, ¿tienes claro si todas las tareas están repartidas y en marcha?`
      );
    }
  }

  // ──────────────────────────────────────────
  // 2. Task management checks
  // ──────────────────────────────────────────
  if (
    scenarioConfig.allowed_interventions.includes('task_management')
  ) {
    const taskRoles = roles.filter(r =>
      r.role_name.startsWith('task')
    );
    taskRoles.forEach(r => {
      if (context.inactiveRoles.includes(r.role_name)) {
        lines.push(
          `${r.username}, ¿tu parte (${label(r.role_name)}) está completada o pendiente de ajuste?`
        );
      }
    });
  }

  // ──────────────────────────────────────────
  // 3. Review / integration checks
  // ──────────────────────────────────────────
  if (
    scenarioConfig.allowed_interventions.includes('review_checks') &&
    (context.phase === 'revision' || context.phase === 'cierre')
  ) {
    const supervisor = roles.find(r => r.role_name === 'supervisor');
    if (supervisor && context.inactiveRoles.includes('supervisor')) {
      lines.push(
        `${supervisor.username}, como ${label('supervisor')}, ¿alguien está revisando que todas las partes encajen antes de entregar?`
      );
    }
  }

  // Limit output length strictly
  return lines.slice(0, 3).join('\n');
}

/**
 * Main entry point for cooperative !ayuda
 */
async function handleCooperativeHelpCommand(message, mode = 'cooperative') {
  console.log(
    `[COOP_HELP] !ayuda en canal ${message.channelId} por ${message.author.username}`
  );

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

  // 2. Load roles
  const roles = await getRoles(message.channelId);
  if (!roles || roles.length === 0) {
    return message.reply(
      '⚠️ No hay roles asignados. Usa primero `/asignar_roles`.'
    );
  }

  // 3. Analyze cooperative context
  const context = await analyzeCooperativeContext(message, roles);
  console.log('[COOP_ANALYZER]', context);

  // 4. Generate response based on analysis + config
  const response = buildCooperativeResponse(context, roles);

  // 5. Log bot intervention if something is said
  if (response.trim().length > 0) {
    await insertBotIntervention(
      message.channelId,
      'coordination',
      mode
    );
    return message.reply(response);
  }

  // 6. Default neutral response
  return message.reply(
    'ℹ️ El proceso parece en marcha. Continuad con las tareas asignadas.'
  );
}

/**
 * Automatic intervention based on cooperative process milestones
 * Triggered only when allowed by configuration and analyzer
 */
async function handleAutomaticMilestoneIntervention(message, roles) {
  // Seguridad: solo si está permitido por configuración
  if (!scenarioConfig.automatic_interventions_enabled) return;

  // Obtener contexto cooperativo
  const context = await analyzeCooperativeContext(message, roles);

  // El analizador decide si tiene sentido intervenir
  if (!context.automaticInterventionRecommended) return;

  const lines = [];

  // ──────────────────────────────────────────
  // START – Recordatorio inicial de roles
  // ──────────────────────────────────────────
  if (context.phase === 'inicio') {
    const coordinator = roles.find(r => r.role_name === 'coordinator');
    if (coordinator) {
      lines.push(
        `Antes de empezar, ${coordinator.username}, como ${label('coordinator')}, confirma que todos saben qué tarea tienen asignada.`
      );
    }
  }

  // ──────────────────────────────────────────
  // MIDPOINT – Comprobación de progreso
  // ──────────────────────────────────────────
  if (context.phase === 'desarrollo') {
    roles.forEach(r => {
      if (context.inactiveRoles.includes(r.role_name)) {
        lines.push(
          `${r.username}, recuerda comprobar que tu parte (${label(r.role_name)}) está avanzando según lo previsto.`
        );
      }
    });
  }

  // ──────────────────────────────────────────
  // PRE_CLOSE – Revisión e integración
  // ──────────────────────────────────────────
  if (context.phase === 'revision' || context.phase === 'cierre') {
    const supervisor = roles.find(r => r.role_name === 'supervisor');
    if (supervisor && context.inactiveRoles.includes('supervisor')) {
      lines.push(
        `${supervisor.username}, como ${label('supervisor')}, revisa que el trabajo final integra todas las partes antes de cerrar.`
      );
    }
  }

  if (lines.length === 0) return;

  // Log de intervención automática
  await insertBotIntervention(
    message.channelId,
    'automatic_milestone',
    'cooperative'
  );

  // Enviar mensaje (máximo 2–3 líneas)
  return message.channel.send(lines.slice(0, 3).join('\n'));
}

module.exports = {
  handleCooperativeHelpCommand,
  handleAutomaticMilestoneIntervention
};