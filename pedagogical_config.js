// Pedagogical Configuration Loader
// Loads appropriate configuration based on bot mode

const { getMode } = require('./config');

// Load the appropriate scenario configuration based on mode
let scenarioConfig;
switch (getMode()) {
  case 'cooperative':
    scenarioConfig = require('./cooperative/scenario_configuration.js');
    break;
  case 'collaborative':
  default:
    scenarioConfig = require('./collaborative/scenario_configuration.js');
    break;
}

/**
 * Get the current pedagogical configuration
 * @returns {Object} Pedagogical configuration object for current mode
 */
function getPedagogicalConfig() {
  // Extract pedagogical config from the scenario config
  return scenarioConfig.pedagogicalConfig || {
    // Fallback defaults if not found
    intervention_policy: "on_demand_only",
    role_strictness: "flexible",
    allowed_interventions: ["regulation", "metacognitive_scaffolding"],
    automatic_interventions_enabled: false
  };
}

/**
 * Get the current bot mode
 * @returns {string} Current mode ("collaborative" or "cooperative")
 */
function getCurrentMode() {
  return getMode();
}

module.exports = {
  getPedagogicalConfig,
  getCurrentMode
};