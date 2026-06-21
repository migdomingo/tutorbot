/**
 * Autonomous simulation engine for Tutorbot.
 *
 * Uses the LLM to generate realistic student messages following a predefined
 * pedagogical arc (sequence of group states). The bot handlers run unmodified.
 *
 * Arc phase format:
 *   {
 *     description: 'Bloqueo inicial',
 *     targetState: 'blocked',      // drives the LLM persona prompt
 *     rotations: 3,                // full rounds through all students
 *     helpAfter: true,             // trigger !ayuda at end of phase
 *     helpStudent: 'sim-u1'        // who triggers !ayuda (default: first student)
 *   }
 *
 * targetState values (same as interaction_analyzer output):
 *   'blocked' | 'scattered' | 'superficial_consensus' | 'productive'
 */

const { SimulationRunner } = require('./runner');

const STATE_DESCRIPTIONS = {
  blocked:               'El grupo está bloqueado: nadie sabe cómo avanzar, hacen preguntas sin respuesta, repiten el mismo problema sin proponer soluciones.',
  scattered:             'El grupo está disperso: pocos hablan, hay silencios, las respuestas son muy cortas (ok, sí, no sé).',
  superficial_consensus: 'El grupo está de acuerdo en todo demasiado rápido: aceptan cualquier propuesta sin cuestionarla, dicen "bien", "vale", "perfecto" sin debatir.',
  productive:            'El grupo trabaja bien: proponen ideas concretas, se hacen preguntas útiles, reparten tareas, muestran progreso.'
};

const STUDENT_SYSTEM_PROMPT = (student, scenario, targetState, historyText) => {
  const botInHistory = historyText && historyText.includes('🤖 **Facilitador:**');
  const productiveNote = (targetState === 'productive' && botInHistory)
    ? '\nIMPORTANTE: El chatbot acaba de hacerte una pregunta directa. RESPÓNDELA de forma concreta y breve antes de seguir con tu idea. Si la pregunta era para otra persona, apoya su respuesta o añade algo relacionado.'
    : '';

  return `\
Eres ${student.username}, un/a estudiante de 4º ESO (14-15 años) trabajando en grupo en Discord.
Actividad: ${scenario.description}.
Tu rol en el grupo: ${student.role}.

SITUACIÓN DEL GRUPO AHORA MISMO:
${STATE_DESCRIPTIONS[targetState] || targetState}
${productiveNote}

NORMAS DE ESCRITURA (imita a un adolescente real en un chat):
- Mensajes muy cortos: 1-2 frases como máximo.
- Lenguaje informal, con errores ortográficos ocasionales, sin mayúsculas al principio, sin puntos al final.
- No expliques lo que haces, simplemente escribe el mensaje.
- NO uses palabras adultas como "propongo", "consideramos", "evaluemos", "estrategia".
- SÉ COHERENTE con el historial del chat y especialmente con los últimos mensajes.

Historial reciente del chat:
${historyText || '(sin mensajes aún)'}

Escribe SOLO tu próximo mensaje, sin comillas, sin tu nombre, sin nada más.`;
};

class AutoSimulation {
  constructor(scenario, openai) {
    this.scenario = scenario;
    this.openai = openai;
    this.runner = new SimulationRunner(scenario);
    this.history = [];  // { username, content }
  }

  async setup() {
    await this.runner.setup();
    // Add seed messages to local history too
    for (const seed of (this.scenario.seedMessages || [])) {
      const student = this.scenario.students.find(s => s.id === seed.studentId);
      if (student) this.history.push({ username: student.username, content: seed.content });
    }
    return this;
  }

  async generateMessage(student, targetState) {
    const historyText = this.runner.channel._history.slice(-14)
      .map(m => `${m.author.bot ? '🤖 Facilitador' : m.author.username}: ${m.content}`)
      .join('\n');

    const completion = await this.openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: STUDENT_SYSTEM_PROMPT(student, this.scenario, targetState, historyText) },
        { role: 'user', content: 'Escribe tu próximo mensaje:' }
      ],
      max_completion_tokens: 80,
      temperature: 0.85
    });

    return completion.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
  }

  async runPhase(phase) {
    const {
      description, targetState, rotations,
      helpAfter, helpStudent,
      absentStudents = [],
      autoIntervention = false
    } = phase;
    const allStudents = this.scenario.students;
    const activeStudents = absentStudents.length > 0
      ? allStudents.filter(s => !absentStudents.includes(s.id))
      : allStudents;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📍 FASE: ${description.toUpperCase()}`);
    console.log(`   Estado simulado: ${targetState}`);
    if (absentStudents.length > 0) {
      const absentNames = allStudents
        .filter(s => absentStudents.includes(s.id))
        .map(s => `${s.username} (${s.role})`)
        .join(', ');
      console.log(`   ⚠️  Ausentes esta fase: ${absentNames}`);
    }
    if (autoIntervention) {
      console.log(`   🔔 Intervención automática activa (el bot monitoriza)`);
    }
    console.log(`${'─'.repeat(60)}\n`);

    for (let r = 0; r < rotations; r++) {
      for (const student of activeStudents) {
        const content = await this.generateMessage(student, targetState);
        console.log(`  💬 ${student.username}: ${content}`);
        this.history.push({ username: student.username, content });
        await this.runner.step(student.id, content);
        await new Promise(res => setTimeout(res, 200));
      }

      if (autoIntervention) {
        console.log(`  🔍 [Bot verifica proceso tras rotación ${r + 1}...]`);
        await this.runner.triggerAutoIntervention(activeStudents[0].id);
      }
    }

    if (helpAfter) {
      const triggerId = helpStudent || allStudents[0].id;
      const triggerStudent = allStudents.find(s => s.id === triggerId) || allStudents[0];
      console.log(`\n  🆘 ${triggerStudent.username} pide !ayuda...\n`);
      await this.runner.triggerAyuda(triggerId);
    }
  }

  async run() {
    this.runner.printHeader();
    if (this.scenario.seedMessages?.length) {
      console.log('  [Historial inicial pre-cargado:]\n');
      for (const s of this.scenario.seedMessages) {
        const student = this.scenario.students.find(st => st.id === s.studentId);
        console.log(`  💬 ${student?.username}: ${s.content}`);
      }
    }

    const arc = this.scenario.arc;
    if (!arc || arc.length === 0) {
      console.error('❌ Este escenario no tiene un arco definido para la simulación automática.');
      return;
    }

    for (const phase of arc) {
      await this.runPhase(phase);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('✅ Simulación automática completada.');
    const state = this.runner.getState();
    console.log(`   Canal: ${state.channelId}`);
    console.log(`   Mensajes totales: ${state.messageCount}`);
    console.log(`   Puedes analizar los datos con: node analysis.js`);
    console.log(`${'═'.repeat(60)}\n`);
  }
}

module.exports = { AutoSimulation };
