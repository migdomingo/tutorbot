// Configuration for Tutorbot modes
// Modes: "collaborative" (default) or "cooperative"

/**
 * Get the current bot mode from environment or command line
 * @returns {string} Current mode
 */
function getMode() {
  // Get mode from environment variable
  const envMode = process.env.BOT_MODE;
  
  // Get mode from command line arguments (mode=xxx)
  let argMode = null;
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('mode=')) {
      argMode = arg.split('=')[1];
      break;
    }
  }
  
  // Priority: command line arg > environment variable > default
  const mode = argMode || envMode || 'collaborative';
  
  // Validate mode
  if (mode !== 'collaborative' && mode !== 'cooperative') {
    console.warn(`Invalid mode "${mode}". Using default "collaborative".`);
    return 'collaborative';
  }
  
  return mode;
}

module.exports = { getMode };