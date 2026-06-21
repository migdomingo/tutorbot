/**
 * Simulation runner for Tutorbot.
 * Sets up the DB state for a scenario and drives the conversation turn by turn.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { FakeChannel, createFakeMessage } = require('./mock_discord');
const {
  dbInitialize,
  clearChannelData,
  upsertRole,
  upsertActivityContext,
  insertParticipationLog,
  getRoles
} = require('../commons/db');
const { handleCollaborativeHelpCommand } = require('../collaborative/help');
const { handleCooperativeHelpCommand, handleAutomaticMilestoneIntervention } = require('../cooperative/help');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

class SimulationRunner {
  constructor(scenario) {
    this.scenario = scenario;
    this.channelId = `sim-${scenario.id}-${Date.now()}`;
    this.channel = new FakeChannel(this.channelId);
    this.studentMap = Object.fromEntries(scenario.students.map(s => [s.id, s]));
  }

  async setup() {
    await dbInitialize();
    await clearChannelData(this.channelId);

    // Register roles in DB
    for (const student of this.scenario.students) {
      await upsertRole(this.channelId, student.id, student.username, student.role);
    }

    // Register activity context for cooperative mode
    if (this.scenario.mode === 'cooperative' && this.scenario.activityContext) {
      const ctx = this.scenario.activityContext;
      const parts = ctx.parts;

      const roleMapping = { coordinator: 'coordina el proceso, no desarrolla partes' };
      for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1 && parts.length > 1) {
          roleMapping['supervisor'] = parts[i];
        } else {
          roleMapping[`task${i + 1}`] = parts[i];
        }
      }

      await upsertActivityContext(
        this.channelId,
        ctx.domain,
        ctx.topic,
        ctx.taskType,
        parts,
        roleMapping
      );
    }

    // Pre-load seed messages
    for (const seed of (this.scenario.seedMessages || [])) {
      const student = this.studentMap[seed.studentId];
      if (!student) continue;
      createFakeMessage(student, seed.content, this.channel);
      await insertParticipationLog(this.channelId, student.id, student.username, this.scenario.mode);
    }

    return this;
  }

  // Add a student message to the channel and log participation
  async step(studentId, content) {
    const student = this.studentMap[studentId];
    if (!student) throw new Error(`Student ID "${studentId}" not found in this scenario`);

    const msg = createFakeMessage(student, content, this.channel);
    await insertParticipationLog(this.channelId, student.id, student.username, this.scenario.mode);

    if (content.trim().toLowerCase().startsWith('!ayuda')) {
      await this._callHelpHandler(msg);
    }

    return msg;
  }

  // Force !ayuda from a given student (without appending to conversation as student message)
  async triggerAyuda(studentId) {
    const student = this.studentMap[studentId] || this.scenario.students[0];
    const msg = createFakeMessage(student, '!ayuda', this.channel);
    await this._callHelpHandler(msg);
  }

  // Trigger automatic milestone intervention (cooperative only).
  // Uses a context object instead of a real message to avoid polluting history.
  async triggerAutoIntervention(studentId) {
    if (this.scenario.mode !== 'cooperative') return;
    const student = this.studentMap[studentId] || this.scenario.students[0];
    const ctx = {
      channelId: this.channelId,
      author: { id: student.id, username: student.username, bot: false },
      channel: this.channel
    };
    const roles = await getRoles(this.channelId);
    if (roles && roles.length > 0) {
      await handleAutomaticMilestoneIntervention(ctx, roles, openai);
    }
  }

  async _callHelpHandler(msg) {
    if (this.scenario.mode === 'collaborative') {
      await handleCollaborativeHelpCommand(msg, openai);
    } else {
      await handleCooperativeHelpCommand(msg, openai);
    }
  }

  // Return current conversation state
  getState() {
    return {
      channelId: this.channelId,
      scenario: this.scenario.id,
      mode: this.scenario.mode,
      messageCount: this.channel._history.length,
      history: this.channel._history.map(m => ({
        author: m.author.username,
        content: m.content
      }))
    };
  }

  printHeader() {
    const { scenario } = this;
    const line = '─'.repeat(60);
    console.log(`\n🎓 SIMULACIÓN: ${scenario.description}`);
    console.log(`   Modo: ${scenario.mode.toUpperCase()} | Canal: ${this.channelId}`);
    console.log(line);
    console.log('Alumnos:');
    for (const s of scenario.students) {
      console.log(`  ${s.username.padEnd(12)} → ${s.role}`);
    }
    if (scenario.activityContext) {
      console.log('\nContexto de actividad:');
      console.log(`  Tema: ${scenario.activityContext.topic}`);
      console.log(`  Partes: ${scenario.activityContext.parts.join(' | ')}`);
    }
    console.log(line);
    const seedCount = (scenario.seedMessages || []).length;
    if (seedCount > 0) {
      console.log(`[Historial pre-cargado: ${seedCount} mensajes]\n`);
    }
  }
}

module.exports = { SimulationRunner };
