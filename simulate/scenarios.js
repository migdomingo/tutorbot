/**
 * Predefined simulation scenarios for Tutorbot.
 *
 * Each scenario defines students, roles, optional activity context (cooperative),
 * seed messages to pre-load the conversation history, and an optional `arc` for
 * autonomous simulation (--auto mode).
 *
 * Arc phase format:
 *   description  — label shown in the transcript
 *   targetState  — 'blocked' | 'scattered' | 'superficial_consensus' | 'productive'
 *   rotations    — number of full rounds through all students
 *   helpAfter    — trigger !ayuda at the end of this phase
 *   helpStudent  — id of the student who triggers !ayuda (default: first student)
 */

const scenarios = [

  // ─────────────────────────────────────────────────────────
  // COLABORATIVO 1: Bloqueo → ayuda → consenso superficial → ayuda
  // (Matemáticas / Estadística)
  // ─────────────────────────────────────────────────────────
  {
    id: 'matematicas_bloqueado',
    mode: 'collaborative',
    description: 'Grupo de 3 alumnos en estadística descriptiva (4º ESO)',
    students: [
      { id: 'sim-u1', username: 'Ana',   role: 'Coordinador/Scrum Master' },
      { id: 'sim-u2', username: 'Pedro', role: 'Secretario/Scribe' },
      { id: 'sim-u3', username: 'Lucía', role: 'Portavoz/Crítico' }
    ],
    activityContext: null,
    seedMessages: [
      { studentId: 'sim-u1', content: '¿por dónde empezamos con el trabajo?' },
      { studentId: 'sim-u2', content: 'no sé, no entiendo qué nos piden' },
      { studentId: 'sim-u3', content: 'yo tampoco' }
    ],
    arc: [
      {
        description: 'Grupo bloqueado sin avanzar',
        targetState: 'blocked',
        rotations: 4,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Reacción post-ayuda: consenso superficial',
        targetState: 'superficial_consensus',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u1'
      },
      {
        description: 'Discusión más crítica tras segunda ayuda',
        targetState: 'productive',
        rotations: 2,
        helpAfter: false
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // COLABORATIVO 2: Progresión con 3 ayudas (Historia / Ciencias Sociales)
  // bloqueo → dispersión → consenso superficial → debate productivo
  // ─────────────────────────────────────────────────────────
  {
    id: 'sociales_3ayudas',
    mode: 'collaborative',
    description: 'Grupo de 3 alumnos analizando la Revolución Industrial (4º ESO)',
    students: [
      { id: 'sim-u1', username: 'Carlos', role: 'Coordinador/Scrum Master' },
      { id: 'sim-u2', username: 'Marta',  role: 'Secretario/Scribe' },
      { id: 'sim-u3', username: 'Javi',   role: 'Portavoz/Crítico' }
    ],
    activityContext: null,
    seedMessages: [
      { studentId: 'sim-u1', content: 'tenemos que hacer el trabajo de la Revolución Industrial' },
      { studentId: 'sim-u2', content: 'sí pero no sé por dónde empezar' },
      { studentId: 'sim-u3', content: 'yo tampoco, hay muchísimas cosas' }
    ],
    arc: [
      {
        description: 'Bloqueo inicial: no saben estructurar el tema',
        targetState: 'blocked',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Post-1ª ayuda: solo Carlos habla, los demás apenas responden',
        targetState: 'scattered',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u1'
      },
      {
        description: 'Post-2ª ayuda: se ponen de acuerdo demasiado rápido sin debatir',
        targetState: 'superficial_consensus',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u3'
      },
      {
        description: 'Post-3ª ayuda: debate real, Javi cuestiona y el grupo profundiza',
        targetState: 'productive',
        rotations: 2,
        helpAfter: false
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // COOPERATIVO 3: App escolar – intervenciones AUTOMÁTICAS del bot
  // (Tecnología, 4 alumnos)
  // Demuestra cómo el bot detecta roles ausentes sin que nadie pida ayuda.
  // Requiere --auto (absentStudents + autoIntervention por rotación)
  // ─────────────────────────────────────────────────────────
  {
    id: 'tecnologia_intervencion_auto',
    mode: 'cooperative',
    description: 'Grupo de 4 alumnos diseñando una app de gestión de tareas escolares (Tecnología)',
    students: [
      { id: 'sim-u1', username: 'Ana',    role: 'coordinator' },
      { id: 'sim-u2', username: 'Bea',    role: 'task1' },
      { id: 'sim-u3', username: 'Carlos', role: 'task2' },
      { id: 'sim-u4', username: 'David',  role: 'supervisor' }
    ],
    activityContext: {
      domain: 'technology',
      topic: 'Diseño de una app móvil para gestión de tareas escolares',
      taskType: 'technical_design',
      parts: [
        'Diseño de interfaz de usuario (pantallas y navegación)',
        'Lógica de datos y almacenamiento',
        'Guía de usuario y pruebas finales'
      ]
    },
    seedMessages: [
      { studentId: 'sim-u1', content: 'ok, cada uno tiene su parte clara ¿no?' },
      { studentId: 'sim-u2', content: 'sí yo diseño las pantallas' },
      { studentId: 'sim-u3', content: 'yo la parte de datos' },
      { studentId: 'sim-u4', content: 'y yo reviso todo al final y hago las pruebas' }
    ],
    arc: [
      {
        description: 'Inicio: todos presentes, reparto claro',
        targetState: 'productive',
        rotations: 1,
        absentStudents: [],
        helpAfter: false,
        autoIntervention: false
      },
      {
        description: 'Ana (coordinadora) desaparece sin avisar',
        targetState: 'scattered',
        rotations: 3,
        absentStudents: ['sim-u1'],
        helpAfter: false,
        autoIntervention: true   // bot detecta coordinadora ausente y actúa
      },
      {
        description: 'Ana regresa y retoman la coordinación',
        targetState: 'productive',
        rotations: 2,
        absentStudents: [],
        helpAfter: false,
        autoIntervention: false
      },
      {
        description: 'Fase revisión: David (supervisor) no integra ni revisa',
        targetState: 'scattered',
        rotations: 3,
        absentStudents: ['sim-u4'],
        helpAfter: false,
        autoIntervention: true   // bot detecta supervisor ausente en fase revisión
      },
      {
        description: 'David actúa, grupo cierra y entrega',
        targetState: 'productive',
        rotations: 1,
        absentStudents: [],
        helpAfter: false,
        autoIntervention: false
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // COOPERATIVO: Diseño técnico con intervenciones automáticas
  // (Tecnología, 4 alumnos)
  // ─────────────────────────────────────────────────────────
  {
    id: 'tecnologia_cooperativo',
    mode: 'cooperative',
    description: 'Grupo de 4 alumnos diseñando un sistema domótico (Tecnología)',
    students: [
      { id: 'sim-u1', username: 'Sofía',   role: 'coordinator' },
      { id: 'sim-u2', username: 'Marcos',  role: 'task1' },
      { id: 'sim-u3', username: 'Elena',   role: 'task2' },
      { id: 'sim-u4', username: 'Roberto', role: 'supervisor' }
    ],
    activityContext: {
      domain: 'technology',
      topic: 'Diseño de sistema domótico para una vivienda estándar',
      taskType: 'technical_design',
      parts: ['Esquema de sensores y actuadores', 'Diagrama de conexiones eléctricas', 'Protocolo de integración final']
    },
    seedMessages: [
      { studentId: 'sim-u1', content: 'cada uno sabe lo que tiene que hacer ¿no?' },
      { studentId: 'sim-u2', content: 'sí, yo el esquema de sensores' },
      { studentId: 'sim-u3', content: 'yo el diagrama eléctrico' },
      { studentId: 'sim-u4', content: 'y yo la integración y revisar que todo cuadre' }
    ],
    arc: [
      {
        description: 'Inicio: todos trabajan pero coordinadora desaparece',
        targetState: 'scattered',
        rotations: 3,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Fase de desarrollo: progresan en sus tareas',
        targetState: 'productive',
        rotations: 3,
        helpAfter: false
      },
      {
        description: 'Pre-cierre: supervisor sin actividad',
        targetState: 'scattered',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u3'
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // COOPERATIVO: Interpretación de gráficas desde ecuaciones
  // (Matemáticas 4º ESO) — 4 alumnos, 10 fases, ~210 mensajes, 7 ayudas
  // Equivalente cooperativo de matematicas_graficas_colaborativo
  // ─────────────────────────────────────────────────────────
  {
    id: 'matematicas_graficas_cooperativo',
    mode: 'cooperative',
    description: 'Grupo de 4 alumnos interpretando 3 gráficas a partir de su ecuación (Matemáticas 4º ESO): y=2x−3, y=x²−4x+3, y=−x²+2x+8',
    students: [
      { id: 'sim-u1', username: 'Daniela', role: 'coordinator' },
      { id: 'sim-u2', username: 'Esteban', role: 'task1' },
      { id: 'sim-u3', username: 'Fátima',  role: 'task2' },
      { id: 'sim-u4', username: 'Gabriel', role: 'supervisor' }
    ],
    activityContext: {
      domain: 'mathematics',
      topic: 'Interpretación de 3 gráficas a partir de su ecuación: y=2x−3, y=x²−4x+3, y=−x²+2x+8 (Matemáticas 4º ESO)',
      taskType: 'mathematical_analysis',
      parts: [
        'Interpretar la función lineal y=2x−3: tipo de función, pendiente, cortes con los ejes y crecimiento/decrecimiento',
        'Interpretar la función cuadrática y=x²−4x+3: tipo, vértice, apertura (cóncava/convexa) y raíces',
        'Interpretar la función cuadrática y=−x²+2x+8: tipo, vértice, apertura y raíces; y sintetizar comparando las 3 funciones'
      ]
    },
    seedMessages: [
      { studentId: 'sim-u1', content: 'bueno, cada uno tiene su función asignada, ¿empezamos ya?' },
      { studentId: 'sim-u2', content: 'sí yo tengo y=2x-3, supongo que es una recta porque no tiene la x al cuadrado' },
      { studentId: 'sim-u3', content: 'yo tengo y=x²-4x+3, parece una parábola pero no sé cómo analizarla' },
      { studentId: 'sim-u4', content: 'y yo y=-x²+2x+8 y encima tengo que comparar las tres al final... mucho trabajo' }
    ],
    arc: [
      {
        description: 'Inicio: cada uno trabaja solo sin compartir ni coordinarse; Daniela no asume el rol de coordinadora',
        targetState: 'scattered',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Post-1ª ayuda: Esteban comparte avances sobre y=2x−3 pero Daniela sigue sin coordinar al grupo',
        targetState: 'productive',
        rotations: 5,
        helpAfter: true,
        helpStudent: 'sim-u1'
      },
      {
        description: 'Esteban bloqueado: sabe que y=2x−3 es una recta pero no sabe cómo calcular los cortes con los ejes',
        targetState: 'blocked',
        rotations: 5,
        helpAfter: true,
        helpStudent: 'sim-u3'
      },
      {
        description: 'Gabriel desaparece mientras los demás avanzan; no ha empezado a analizar su función',
        targetState: 'scattered',
        rotations: 5,
        helpAfter: true,
        helpStudent: 'sim-u4'
      },
      {
        description: 'Post-4ª ayuda: el grupo empieza a compartir avances; Fátima explica su parábola al resto',
        targetState: 'productive',
        rotations: 5,
        helpAfter: false
      },
      {
        description: 'Fátima monopoliza la conversación sobre las parábolas; Esteban y Gabriel responden con monosílabos',
        targetState: 'scattered',
        rotations: 5,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Post-6ª ayuda: responden al chatbot, Gabriel empieza su análisis de y=−x²+2x+8',
        targetState: 'productive',
        rotations: 5,
        helpAfter: false
      },
      {
        description: 'Fase de integración: Gabriel tiene su parte pero no sabe cómo comparar y conectar las 3 funciones',
        targetState: 'blocked',
        rotations: 5,
        helpAfter: true,
        helpStudent: 'sim-u3'
      },
      {
        description: 'Post-8ª ayuda: intentan integrar las 3 funciones pero hay desconexiones entre los análisis individuales',
        targetState: 'productive',
        rotations: 5,
        helpAfter: true,
        helpStudent: 'sim-u4'
      },
      {
        description: 'Síntesis final: comparan las 3 funciones (lineal vs cuadrática, apertura, raíces) y cierran el trabajo',
        targetState: 'productive',
        rotations: 7,
        helpAfter: false
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // COOPERATIVO 2: Historia – Revolución Industrial (3 ayudas)
  // dispersión → coordinación → bloqueo integración → cierre
  // ─────────────────────────────────────────────────────────
  {
    id: 'sociales_cooperativo',
    mode: 'cooperative',
    description: 'Grupo de 4 alumnos analizando la Revolución Industrial (Historia, 4º ESO)',
    students: [
      { id: 'sim-u1', username: 'Sofía',  role: 'coordinator' },
      { id: 'sim-u2', username: 'Marcos', role: 'task1' },
      { id: 'sim-u3', username: 'Elena',  role: 'task2' },
      { id: 'sim-u4', username: 'Pablo',  role: 'supervisor' }
    ],
    activityContext: {
      domain: 'history',
      topic: 'La Revolución Industrial y sus consecuencias (siglos XVIII-XIX)',
      taskType: 'research_analysis',
      parts: [
        'Causas y antecedentes históricos',
        'Transformaciones económicas e industriales',
        'Consecuencias sociales y laborales'
      ]
    },
    seedMessages: [
      { studentId: 'sim-u1', content: 'bueno, cada uno sabe lo que tiene que hacer ¿no?' },
      { studentId: 'sim-u2', content: 'sí yo me pongo con las causas' },
      { studentId: 'sim-u3', content: 'yo con la economía y la industria' },
      { studentId: 'sim-u4', content: 'y yo reviso al final' }
    ],
    arc: [
      {
        description: 'Inicio: cada uno trabaja solo, sin coordinación entre sí',
        targetState: 'scattered',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Post-1ª ayuda: Sofía empieza a coordinar, el grupo mejora',
        targetState: 'productive',
        rotations: 2,
        helpAfter: false
      },
      {
        description: 'Fase integración: Pablo (supervisor) no ha revisado nada todavía',
        targetState: 'scattered',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u3'
      },
      {
        description: 'Post-2ª ayuda: intentan integrar pero hay lagunas entre partes',
        targetState: 'blocked',
        rotations: 2,
        helpAfter: true,
        helpStudent: 'sim-u4'
      },
      {
        description: 'Post-3ª ayuda: el grupo completa la integración y cierra el trabajo',
        targetState: 'productive',
        rotations: 2,
        helpAfter: false
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // COLABORATIVO 4: Interpretación de gráficas desde ecuaciones
  // (Matemáticas 4º ESO) — 3 roles, 11 fases, ~210 mensajes, 9 ayudas
  // Diseñado para observar cómo la intervención del chatbot regula al grupo
  // ─────────────────────────────────────────────────────────
  {
    id: 'matematicas_graficas_colaborativo',
    mode: 'collaborative',
    description: 'Grupo de 3 alumnos interpretando 3 gráficas a partir de su ecuación (Matemáticas 4º ESO): y=2x−3, y=x²−4x+3, y=−x²+2x+8',
    students: [
      { id: 'sim-u1', username: 'Alba',   role: 'Moderador/Coordinador' },
      { id: 'sim-u2', username: 'Bruno',  role: 'Secretario/Scribe' },
      { id: 'sim-u3', username: 'Carmen', role: 'Portavoz/Crítico' }
    ],
    activityContext: null,
    seedMessages: [
      { studentId: 'sim-u1', content: 'bueno, tenemos que interpretar cómo son tres gráficas a partir de sus ecuaciones, ¿por dónde empezamos?' },
      { studentId: 'sim-u2', content: 'no sé muy bien lo que nos piden, ¿interpretar significa dibujarla o explicarla?' },
      { studentId: 'sim-u3', content: 'yo creo que es explicar cómo es la gráfica sin dibujarla, pero no sé cómo hacerlo' }
    ],
    arc: [
      {
        description: 'Bloqueo inicial: no saben qué significa interpretar una gráfica ni por dónde empezar con y=2x−3',
        targetState: 'blocked',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Post-1ª ayuda: intentan responder al chatbot sobre y=2x−3 pero el grupo sigue sin coordinarse',
        targetState: 'scattered',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u1'
      },
      {
        description: 'Consenso superficial sobre y=2x−3: acuerdan "es una recta que sube" sin profundizar en pendiente ni corte con ejes',
        targetState: 'superficial_consensus',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u3'
      },
      {
        description: 'Análisis profundo de y=2x−3 tras activación del Crítico por el chatbot: debaten pendiente, cortes y dominio',
        targetState: 'productive',
        rotations: 7,
        helpAfter: false
      },
      {
        description: 'Bloqueo con la parábola y=x²−4x+3: no saben calcular el vértice ni si abre hacia arriba o abajo',
        targetState: 'blocked',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Dispersión ante la parábola: Bruno habla solo, Alba y Carmen responden con monosílabos',
        targetState: 'scattered',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u1'
      },
      {
        description: 'Análisis productivo de y=x²−4x+3: responden a preguntas del chatbot, trabajan el vértice y las raíces juntos',
        targetState: 'productive',
        rotations: 7,
        helpAfter: true,
        helpStudent: 'sim-u3'
      },
      {
        description: 'Consenso superficial en y=−x²+2x+8: pasan demasiado rápido, aceptan "es una parábola al revés" sin analizar',
        targetState: 'superficial_consensus',
        rotations: 5,
        helpAfter: true,
        helpStudent: 'sim-u2'
      },
      {
        description: 'Debate crítico sobre y=−x²+2x+8: Carmen cuestiona el vértice y la apertura, el grupo profundiza',
        targetState: 'productive',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u1'
      },
      {
        description: 'Bloqueo pre-cierre: han analizado las 3 funciones pero no saben cómo conectarlas ni hacer la conclusión conjunta',
        targetState: 'blocked',
        rotations: 6,
        helpAfter: true,
        helpStudent: 'sim-u3'
      },
      {
        description: 'Cierre y conclusiones: sintetizan las 3 funciones, comparan tipos (lineal vs cuadrática) y cierran el trabajo',
        targetState: 'productive',
        rotations: 8,
        helpAfter: false
      }
    ]
  },

  // ─────────────────────────────────────────────────────────
  // COLABORATIVO 3: Consenso superficial → crítica → ayuda
  // (Ciencias Naturales / Biología)
  // ─────────────────────────────────────────────────────────
  {
    id: 'ciencias_consenso_superficial',
    mode: 'collaborative',
    description: 'Grupo de 3 alumnos en trabajo de Biología (4º ESO)',
    students: [
      { id: 'sim-u1', username: 'Laura',   role: 'Coordinador/Scrum Master' },
      { id: 'sim-u2', username: 'Diego',   role: 'Secretario/Scribe' },
      { id: 'sim-u3', username: 'Nuria',   role: 'Portavoz/Crítico' }
    ],
    activityContext: null,
    seedMessages: [
      { studentId: 'sim-u1', content: 'hacemos el trabajo sobre la fotosíntesis' },
      { studentId: 'sim-u2', content: 'ok' },
      { studentId: 'sim-u3', content: 'me parece bien' }
    ],
    arc: [
      {
        description: 'Consenso superficial: todo el mundo dice que sí a todo',
        targetState: 'superficial_consensus',
        rotations: 3,
        helpAfter: true,
        helpStudent: 'sim-u1'
      },
      {
        description: 'Primer debate crítico tras la ayuda del bot',
        targetState: 'productive',
        rotations: 3,
        helpAfter: false
      }
    ]
  }
];

function getScenario(id) {
  return scenarios.find(s => s.id === id) || null;
}

function listScenarios() {
  return scenarios.map(s => ({
    id: s.id,
    mode: s.mode,
    description: s.description,
    students: s.students.length,
    hasArc: !!s.arc
  }));
}

module.exports = { scenarios, getScenario, listScenarios };
