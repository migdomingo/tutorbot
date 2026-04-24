// Test script to verify pedagogical configuration loading
// We need to test in separate processes to avoid module caching issues

const { spawnSync } = require('child_process');

console.log('=== Testing Pedagogical Configuration ===\n');

function testMode(modeValue, source) {
  console.log(`${source}:`);
  
  // Set up environment
  const env = Object.create(process.env);
  if (modeValue !== undefined) {
    env.BOT_MODE = modeValue;
  }
  
  // Determine args
  let args = ['node', '-e', 
    `const { getPedagogicalConfig, getCurrentMode } = require('./pedagogical_config');` +
    `const config = getPedagogicalConfig();` +
    `const mode = getCurrentMode();` +
    `console.log(JSON.stringify({mode, config}));`
  ];
  
  if (modeValue === 'cooperative' && source === 'Command Line') {
    args = ['node', 'index.js', 'mode=cooperative', '-e', 
      `const { getPedagogicalConfig, getCurrentMode } = require('./pedagogical_config');` +
      `const config = getPedagogicalConfig();` +
      `const mode = getCurrentMode();` +
      `console.log(JSON.stringify({mode, config}));`
    ];
  }
  
  // Run test
  const result = spawnSync('node', 
    modeValue === 'cooperative' && source === 'Command Line' 
      ? ['index.js', 'mode=cooperative', '-e', 
        `const { getPedagogicalConfig, getCurrentMode } = require('./pedagogical_config');` +
        `const config = getPedagogicalConfig();` +
        `const mode = getCurrentMode();` +
        `console.log(JSON.stringify({mode, config}));`]
      : ['-e', 
        `const { getPedagogicalConfig, getCurrentMode } = require('./pedagogical_config');` +
        `const config = getPedagogicalConfig();` +
        `const mode = getCurrentMode();` +
        `console.log(JSON.stringify({mode, config}));`],
    { env, cwd: __dirname }
  );
  
  const output = result.stdout.toString().trim();
  try {
    const parsed = JSON.parse(output);
    console.log(`   Mode: ${parsed.mode}`);
    console.log(`   Intervention Policy: ${parsed.config.intervention_policy}`);
    console.log(`   Role Strictness: ${parsed.config.role_strictness}`);
    console.log(`   Allowed Interventions: ${parsed.config.allowed_interventions.join(', ')}`);
    console.log(`   Automatic Interventions: ${parsed.config.automatic_interventions_enabled}`);
  } catch (e) {
    console.log(`   Error parsing output: ${output}`);
    console.log(`   Stderr: ${result.stderr.toString()}`);
  }
  console.log('');
}

testMode(undefined, '1. Default (no env, no args)');
testMode('collaborative', '2. Env var: collaborative');
testMode('cooperative', '3. Env var: cooperative');
testMode('cooperative', '4. Command line: mode=cooperative');

console.log('✅ All tests completed!');