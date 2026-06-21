#!/usr/bin/env node
/**
 * Tutorbot Simulation CLI
 *
 * Usage:
 *   node simulate.js --list
 *   node simulate.js --scenario=matematicas_bloqueado           (interactive)
 *   node simulate.js --scenario=matematicas_bloqueado --auto    (autonomous, LLM-driven)
 *
 * Interactive commands:
 *   <studentId> <message>   → Send a message as that student
 *   ayuda <studentId>       → Trigger !ayuda from that student
 *   estado                  → Print conversation state
 *   q / quit                → End simulation
 */

require('dotenv').config();
// Simulation-specific overrides (must be set before any module require)
process.env.SIMULATION_MODE = 'true';
process.env.SIMULATION_FETCH_LIMIT = '8'; // smaller window so absent roles are detected faster

const readline = require('readline');
const { OpenAI } = require('openai');
const { SimulationRunner } = require('./simulate/runner');
const { AutoSimulation } = require('./simulate/auto_simulation');
const { getScenario, listScenarios } = require('./simulate/scenarios');
const { getChannelStats, insertTeacherAssessment } = require('./commons/db');

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? true];
    })
);

async function runReports(runner, openai) {
  const state = runner.getState();
  const { channelId, mode } = state;

  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊  INFORME PEDAGÓGICO');
  console.log(`${'═'.repeat(60)}\n`);

  const stats = await getChannelStats(channelId);

  console.log('👥  Roles asignados:');
  for (const r of stats.roles) console.log(`   • ${r.role_name}: ${r.username}`);

  console.log('\n📈  Participación (mensajes por alumno):');
  if (stats.participation.length === 0) {
    console.log('   Sin actividad registrada.');
  } else {
    for (const p of stats.participation) console.log(`   • ${p.username}: ${p.msg_count} mensajes`);
  }

  console.log(`\n🆘  Solicitudes de ayuda (!ayuda): ${stats.helpCount}`);

  console.log('\n⚡  Intervenciones del bot:');
  if (stats.interventions.length === 0) {
    console.log('   Sin intervenciones registradas.');
  } else {
    const total = stats.interventions.reduce((s, i) => s + i.count, 0);
    for (const i of stats.interventions) {
      const pct = ((i.count / total) * 100).toFixed(1);
      console.log(`   • ${i.intervention_type}: ${i.count} (${pct}%)`);
    }
  }

  // Diagnóstico orientativo
  const msgs = stats.participation.map(p => p.msg_count);
  const avgMsgs = msgs.length ? msgs.reduce((a, b) => a + b, 0) / msgs.length : 1;
  const maxMsgs = msgs.length ? Math.max(...msgs) : 1;
  const equalityIndex = maxMsgs / avgMsgs;

  console.log('\n🔍  Diagnóstico orientativo:');
  if (stats.helpCount > 5)       console.log('   Alto uso del facilitador externo.');
  else if (stats.helpCount <= 2) console.log('   Bajo uso del facilitador; promueven autonomía.');
  else                           console.log('   Uso moderado del facilitador.');

  if (equalityIndex > 1.8)      console.log('   Participación desequilibrada (algún miembro domina).');
  else if (equalityIndex < 1.3) console.log('   Participación equilibrada entre miembros.');
  else                          console.log('   Participación moderadamente distribuida.');

  // ── Informe Docente (LLM) ───────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📋  INFORME DOCENTE (generado por IA)');
  console.log(`${'═'.repeat(60)}\n`);
  console.log('🔄  Llamando a la IA para generar la valoración cualitativa...\n');

  const avgScore = stats.peerReviews.length > 0
    ? (stats.peerReviews.reduce((a, b) => a + b.score, 0) / stats.peerReviews.length).toFixed(1)
    : 'N/A';

  const statsText = [
    `Roles asignados: ${stats.roles.map(r => `${r.username}(${r.role_name})`).join(', ') || 'ninguno'}`,
    `Alumnos activos: ${stats.participation.length}`,
    `Mensajes por alumno: ${stats.participation.map(p => `${p.username}:${p.msg_count}`).join(', ') || 'ninguno'}`,
    `Solicitudes de ayuda: ${stats.helpCount}`,
    `Intervenciones del bot: ${stats.interventions.map(i => `${i.intervention_type}:${i.count}`).join(', ') || '0'}`,
    `Coevaluaciones: ${stats.peerReviews.length} entradas, media ${avgScore}/5`
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un asistente pedagógico. Genera un informe de seguimiento grupal para el docente a partir de métricas de proceso de un bot educativo. Devuelve SOLO un objeto JSON con exactamente estos campos: participation_summary, regulation_summary, collaboration_summary, strengths, improvement_suggestions, overall_assessment. Cada campo: máximo 2 frases. Idioma: español de España.`
      },
      { role: 'user', content: `Métricas del grupo (modo ${mode}):\n${statsText}` }
    ]
  });

  const assessment = JSON.parse(completion.choices[0].message.content);
  await insertTeacherAssessment(channelId, assessment, mode);

  console.log(`👥  Participación:    ${assessment.participation_summary}`);
  console.log(`📊  Regulación:      ${assessment.regulation_summary}`);
  console.log(`🤝  Colaboración:    ${assessment.collaboration_summary}`);
  console.log(`✨  Fortalezas:      ${assessment.strengths}`);
  console.log(`💡  Mejoras:         ${assessment.improvement_suggestions}`);
  console.log(`📝  Valoración:      ${assessment.overall_assessment}`);
  console.log(`\n   ✅ Informe guardado en BD. Visible también con: node analysis.js`);
}

async function main() {
  // ── --list ──────────────────────────────────────────────
  if (args.list) {
    console.log('\n📋 Escenarios disponibles:\n');
    for (const s of listScenarios()) {
      console.log(`  ${s.id}`);
      console.log(`    Modo: ${s.mode} | Alumnos: ${s.students} | Auto: ${s.hasArc ? 'sí' : 'no'}`);
      console.log(`    ${s.description}\n`);
    }
    return;
  }

  // ── --scenario ──────────────────────────────────────────
  const scenarioId = args.scenario;
  if (!scenarioId) {
    console.error('❌ Indica un escenario con --scenario=<id>  o lista los disponibles con --list');
    process.exit(1);
  }

  const scenario = getScenario(scenarioId);
  if (!scenario) {
    console.error(`❌ Escenario "${scenarioId}" no encontrado. Usa --list para ver los disponibles.`);
    process.exit(1);
  }

  // ── --auto ───────────────────────────────────────────────
  if (args.auto) {
    if (!scenario.arc) {
      console.error(`❌ El escenario "${scenarioId}" no tiene un arco definido para el modo automático.`);
      process.exit(1);
    }
    const sim = new AutoSimulation(scenario, openai);
    await sim.setup();
    await sim.run();
    if (args.report) {
      await runReports(sim.runner, openai);
    }
    process.exit(0);
  }

  // ── Setup ────────────────────────────────────────────────
  const runner = new SimulationRunner(scenario);
  await runner.setup();
  runner.printHeader();

  const studentIds = scenario.students.map(s => s.id);
  const studentNames = scenario.students.map(s => `${s.id}=${s.username}`).join(', ');

  console.log(`Alumnos disponibles: ${studentNames}`);
  console.log('Comandos: "<id> <mensaje>" | "ayuda <id>" | "estado" | "q"\n');

  // ── Interactive REPL ─────────────────────────────────────
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => rl.question('▶ ', handleLine);

  async function handleLine(line) {
    const input = line.trim();

    if (!input) { prompt(); return; }

    if (input === 'q' || input === 'quit') {
      console.log('\n📊 Simulación finalizada. Puedes analizar los datos con: node analysis.js\n');
      const state = runner.getState();
      console.log(`  Canal: ${state.channelId}`);
      console.log(`  Mensajes enviados: ${state.messageCount}`);
      rl.close();
      process.exit(0);
    }

    if (input === 'estado') {
      const state = runner.getState();
      console.log(`\n  Canal: ${state.channelId} | Mensajes: ${state.messageCount}`);
      console.log('  Historial:');
      state.history.forEach(m => console.log(`    ${m.author}: ${m.content}`));
      console.log('');
      prompt(); return;
    }

    // ayuda <studentId>
    if (input.startsWith('ayuda')) {
      const parts = input.split(/\s+/);
      const studentId = parts[1] || studentIds[0];
      if (!studentIds.includes(studentId)) {
        console.log(`  ⚠️  ID de alumno desconocido: "${studentId}". Disponibles: ${studentIds.join(', ')}`);
        prompt(); return;
      }
      try {
        await runner.triggerAyuda(studentId);
      } catch (err) {
        console.error('  ❌ Error al procesar ayuda:', err.message);
      }
      prompt(); return;
    }

    // <studentId> <message>
    const spaceIdx = input.indexOf(' ');
    if (spaceIdx === -1) {
      console.log('  ⚠️  Formato: "<id_alumno> <mensaje>"  (ej: sim-u1 No sé cómo seguir)');
      prompt(); return;
    }

    const studentId = input.slice(0, spaceIdx).trim();
    const content = input.slice(spaceIdx + 1).trim();

    if (!studentIds.includes(studentId)) {
      console.log(`  ⚠️  ID de alumno desconocido: "${studentId}". Disponibles: ${studentIds.join(', ')}`);
      prompt(); return;
    }

    const student = scenario.students.find(s => s.id === studentId);
    console.log(`  💬 ${student.username}: ${content}`);

    try {
      await runner.step(studentId, content);
    } catch (err) {
      console.error('  ❌ Error al procesar mensaje:', err.message);
    }

    prompt();
  }

  prompt();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
