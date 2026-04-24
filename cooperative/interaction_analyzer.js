/**
 * Cooperative Interaction Analyzer
 * --------------------------------
 * Analyzer for STRUCTURED COOPERATIVE LEARNING.
 * Focus: process state, role activity, phase progression.
 *
 * IMPORTANT:
 * - No semantic or cognitive analysis
 * - No idea quality analysis
 * - No conflict detection
 */

const scenarioConfig = require('./scenario_configuration.js');

/**
 * Determine current process phase based on elapsed activity
 * This is intentionally simple and deterministic.
 */
function determinePhase(messageCount) {
  const phases = scenarioConfig.phases.order;

  if (messageCount < 10) return phases[0];       // inicio
  if (messageCount < 25) return phases[1];       // desarrollo
  if (messageCount < 40) return phases[2];       // revision
  return phases[3];                              // cierre
}

/**
 * Analyze role activity (presence only, not quality)
 */
function analyzeRoles(roles, recentMessages) {
  const activeRoleIds = new Set();

  recentMessages.forEach(msg => {
    const matchingRole = roles.find(r => r.user_id === msg.author.id);
    if (matchingRole) {
      activeRoleIds.add(matchingRole.role_name);
    }
  });

  const inactiveRoles = roles
    .map(r => r.role_name)
    .filter(roleName => !activeRoleIds.has(roleName));

  return {
    activeRoles: Array.from(activeRoleIds),
    inactiveRoles
  };
}

/**
 * Detect possible cooperative bottlenecks
 * (purely structural, not cognitive)
 */
function detectProcessIssues(phase, inactiveRoles) {
  const issues = [];

  // If coordinator inactive at any stage → issue
  if (inactiveRoles.includes('coordinator')) {
    issues.push('missing_coordination');
  }

  // If revision phase but no supervisor activity
  if (phase === 'revision' || phase === 'cierre') {
    if (inactiveRoles.includes('supervisor')) {
      issues.push('missing_final_review');
    }
  }

  return issues;
}

/**
 * Main cooperative context analyzer
 */
async function analyzeCooperativeContext(message, roles) {
  let recentMessages;

  try {
    recentMessages = await message.channel.messages.fetch({ limit: 30 });
    recentMessages = recentMessages.filter(m => !m.author.bot);
    console.log(`[COOP_ANALYZER] Fetched ${recentMessages.size} non-bot messages for analysis`);
  } catch (err) {
    console.error('[COOP_ANALYZER] Error fetching messages:', err);
    recentMessages = new Map(); // empty Collection-like object
  }

  const messageCount = recentMessages.size;
  console.log(`[COOP_ANALYZER] Message count: ${messageCount}`);

  const phase = determinePhase(messageCount);
  console.log(`[COOP_ANALYZER] Determined phase: ${phase}`);

  const roleAnalysis = analyzeRoles(
    roles,
    recentMessages
  );
  console.log(`[COOP_ANALYZER] Active roles: ${roleAnalysis.activeRoles.join(', ')}`);
  console.log(`[COOP_ANALYZER] Inactive roles: ${roleAnalysis.inactiveRoles.join(', ')}`);

  const processIssues = detectProcessIssues(
    phase,
    roleAnalysis.inactiveRoles
  );
  console.log(`[COOP_ANALYZER] Process issues detected: ${processIssues.join(', ')}`);

  const automaticInterventionRecommended =
    scenarioConfig.automatic_interventions_enabled &&
    processIssues.length > 0;

  console.log(`[COOP_ANALYZER] Automatic intervention recommended: ${automaticInterventionRecommended}`);

  return {
    mode: 'cooperative',
    phase,
    messageCount,
    activeRoles: roleAnalysis.activeRoles,
    inactiveRoles: roleAnalysis.inactiveRoles,
    processIssues,
    automaticInterventionRecommended
  };
}

module.exports = {
  analyzeCooperativeContext
};