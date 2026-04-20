/**
 * Scenario Configuration: Cooperative Project-Based Learning
 *
 * Centralized pedagogical configuration for the facilitator bot.
 * All configurable parameters are defined here.
 *
 * Educational Context: Spanish 4th Year ESO (Educación Secundaria Obligatoria)
 * Subject: Cross-curricular project (e.g., Sciences, Technology, or Social Sciences)
 *
 * @file scenario_project.js
 * @author Miguel Ángel Domingo - Tutorbot Project
 * @institution Universidad Nebrija - TFG/TFM Research
 */

module.exports = {
  /**
   * Scenario Metadata
   */
  name: "cooperative_project_basic",
  educationalLevel: "4th_ESO",
  taskType: "project",

  /**
   * Conversation Stage Thresholds (based on recent message count)
   */
  conversationStages: {
    thresholds: {
      inicio: 10,      // ≤10 messages → inicio
      desarrollo: 30   // 11-30 messages → desarrollo, >30 → cierre
    },
    labels: {
      inicio: "inicio",
      desarrollo: "desarrollo",
      cierre: "cierre"
    }
  },

  /**
   * Group State Diagnostics
   * Conditions to classify the group's current state
   */
  groupStates: {
    blocked: {
      name: "blocked",
      condition: "recentMessageCount >= 15 && progressIndicators === 0 && questionIndicators > 5",
      instruction: "GRUPO BLOQUEADO: Prioriza estrategias de desbloqueo (dividir problema, generar opciones, criterio temporal, reformular pregunta, priorizar). Ofrécelas como preguntas, no como órdenes."
    },
    scattered: {
      name: "scattered",
      condition: "distinctAuthors < 3 && recentMessageCount > 10",
      instruction: "GRUPO DISPERSO: Usa estrategias de reorganización (reparto claro, timeboxing, rondas de turnos). Dirígete al COORDINADOR para que gestione enfoque y equidad."
    },
    superficial_consensus: {
      name: "superficial_consensus",
      condition: "questionIndicators < 2 && progressIndicators > recentMessageCount * 0.6",
      instruction: "CONSENSO SUPERFICIAL: Usa estrategias de profundización (cuestionar supuestos, pedir justificaciones, buscar alternativas). Activa al CRÍTICO."
    },
    productive: {
      name: "productive",
      condition: "default",
      instruction: "GRUPO PRODUCTIVO: Refuerza lo que funciona y sugiere mejoras incrementales con preguntas. Mantén el ritmo."
    }
  },

  /**
   * Idea Quality Diagnostics
   */
  ideaQuality: {
    many_undecided: {
      name: "many_undecided",
      condition: "decisionIndicators === 0 && recentMessageCount > 10",
      instruction: "Hay muchas ideas sin decidir. Ayuda al equipo a establecer CRITERIOS DE SELECCIÓN, no elijas por ellos."
    },
    few_well_justified: {
      name: "few_well_justified",
      condition: "decisionIndicators > 0 && justificationIndicators < decisionIndicators * 0.5",
      instruction: "Pocas ideas bien justificadas. Riesgo de pensamiento grupal. Pide al CRÍTICO que cuestione y busque alternativas."
    },
    balanced: {
      name: "balanced",
      condition: "default",
      instruction: "Equilibrio bueno. Revisa que las decisiones estén documentadas y el avance es claro."
    }
  },

  /**
   * Scaffolding Level Configuration
   * Determines concreteness of suggestions based on functional inactivity
   */
  scaffoldingLevels: {
    high: {
      name: "high",
      condition: "groupState === 'blocked' || functionalInactivity.length >= 2",
      instruction: "NIVEL ALTO: El grupo necesita guía fuerte. Ofrece estructuras muy concretas COMO OPCIONES entre las que elegir, no como órdenes."
    },
    medium: {
      name: "medium",
      condition: "groupState === 'scattered' || functionalInactivity.length === 1",
      instruction: "NIVEL MEDIO: Sugiere técnicas y deja que el equipo elija qué implementar."
    },
    light: {
      name: "light",
      condition: "default",
      instruction: "NIVEL BAJO: Preguntas ligeras para mantener el ritmo. No sobreestructures."
    }
  },

  /**
   * Cooperative Roles Definition
   */
  roles: [
    {
      id: "coordinator",
      displayName: "Coordinador/a",
      responsibilities: [
        "Gestionar los tiempos y la agenda de trabajo",
        "Asegurar que todos participen",
        "Resolver conflictos de coordinación",
        "Fomentar la interdependencia positiva"
      ],
      interventionTriggers: [
        "Cuando el equipo no avanza o se dispersa",
        "Si hay desigualdad en la participación",
        "Para recordar plazos y objetivos"
      ]
    },
    {
      id: "secretary",
      displayName: "Secretario/a",
      responsibilities: [
        "Registrar las ideas clave del equipo",
        "Sintetizar acuerdos y conclusiones",
        "Documentar el proceso de toma de decisiones",
        "Mantener un acta de trabajo colaborativo"
      ],
      interventionTriggers: [
        "Cuando se han discutido varias ideas sin resumen",
        "Si hay confusión sobre lo decidido",
        "Para consolidar el conocimiento grupal"
      ]
    },
    {
      id: "critic",
      displayName: "Portavoz / Crítico/a",
      responsibilities: [
        "Cuestionar suposiciones y buscar fallos lógicos",
        "Proponer alternativas y mejoras",
        "Defender el trabajo ante el profesorado",
        "Asegurar la calidad y rigor del producto"
      ],
      interventionTriggers: [
        "Cuando el equipo acepta ideas sin debate crítico",
        "Si hay posibles errores o inconsistencias",
        "Para elevar la calidad del trabajo"
      ]
    }
  ],

  /**
   * Role-Specific Questions Bank
   * Open-ended questions for each role and conversation stage
   * These are the MODELOS DE ACCIÓN (questions, not directives)
   */
  roleQuestions: {
    coordinator: {
      inicio: [
        "¿Habéis definido el producto final? Si no, ¿qué alternativas estáis considerando?",
        "¿Cómo desglosaríais el proyecto en hitos con responsables? ¿Qué criterios usaríais para asignarlos: por interés, por competencia o por disponibilidad?",
        "¿Qué técnica de planificación conocéis que os ayude a visualizar el camino: backwards planning, Design Thinking o Canvas?",
        "¿Qué timeline os parece realista? ¿Qué checkpoints necesitáis para verificar avances?",
        "¿Quién se encarga de coordinar cada hito y cómo comunicaréis los cambios?"
      ],
      desarrollo: [
        "¿Cómo estáis distribuyendo las tareas actualmente? ¿Cada miembro tiene responsabilidades exclusivas y claras?",
        "¿Qué formato de sincronización os funciona mejor: daily de 2 minutos, checkpoints cada hora, o revisión por hitos?",
        "Si hay cuellos de botella, ¿qué estrategias de redistribución habéis probado: emparejamiento, rotación o help?",
        "¿Qué sistema de visualización del progreso os parece más útil: Kanban, checklist o Gantt colaborativo?",
        "¿Cómo identificáis y resolvéis los conflictos de coordinación que surgen?"
      ],
      cierre: [
        "¿Cómo aseguráis que todos los requisitos estén cubiertos antes de entregar? ¿Habéis hecho una revisión por pares?",
        "¿Qué criterios usaríais para validar la calidad mínima del trabajo: lista de verificación, prueba piloto o revisión externa?",
        "¿Cómo preparáis la defensa: quién expone qué, y qué formato practicáis (guión, diapositivas, demostración)?",
        "¿Qué formato de retrospectiva preferís: qué funcionó/mejoraría/aprendizaje, o start/stop/continue?",
        "¿Cómo guardaréis la memoria del proyecto para futuras consultas?"
      ]
    },
    secretary: {
      inicio: [
        "¿Qué estructura de acta os parece más efectiva: lista de decisiones, tabla de tareas, mapa conceptual o acta narrativa?",
        "¿Qué columnas incluiríais en vuestra plantilla: IDEA, RESPONSABLE, FECHA, ESTADO, EVIDENCIA, DECISIÓN?",
        "¿Cómo documentaréis el rationale de cada decisión: por qué elegís X sobre Y, qué alternativas descartasteis?",
        "¿Dónde guardaréis el documento compartido para que todos tengan acceso simultáneo: Drive, Notion, GitHub?",
        "¿Quién será el responsable de mantener el documento actualizado y cómo os aseguráis de que esté al día?",
        "¿Con qué frecuencia actualizáis el acta: después de cada reunión o al final?"
      ],
      desarrollo: [
        "¿Qué información registráis además de los acuerdos: dudas pendientes, decisiones reversibles, bloqueos identificados?",
        "¿Qué formato de resumen por sesión os resulta más útil: logros/bloqueos/siguientes pasos, o simplemente una lista de acuerdos?",
        "¿Mantendréis un glosario compartido de términos clave? ¿Cómo lo estructuraríais: alfabético, temático o por definición?",
        "¿Cómo documentáis las alternativas descartadas para aprender en el futuro: registro breve, tabla comparativa o notas reflexivas?",
        "¿Cómo aseguráis que el documento sea accesible y legible para todos los miembros?"
      ],
      cierre: [
        "¿En qué formato sintetizáis el trabajo: 3 párrafos (objetivo/proceso/resultado), puntos clave en viñetas, o presentación ejecutiva?",
        "¿Qué elementos incluiríais en la lista de 'lecciones aprendidas': ejemplos concretos, errores cometidos, aciertos inesperados?",
        "¿Cómo estructuraríais el acta final para que sirva como memoria del proyecto: cronología, decisiones clave o hitos alcanzados?",
        "¿Qué nivel de detalle necesita un resumen ejecutivo para que una persona externa lo entienda sin contexto previo?",
        "¿Habéis considerado añadir un anexo con evidencias o materiales de soporte?"
      ]
    },
    critic: {
      inicio: [
        "¿Qué supuestos clave estáis dando por válidos sin verificar? ¿Cómo podríais testarlos: con una prueba rápida, contraste con otros grupos, o búsqueda de evidencias?",
        "¿Qué criterios de éxito habéis definido ANTES de avanzar? ¿Son medibles, alcanzables y relevantes?",
        "¿Estáis eligiendo la solución más eficiente o simplemente la más obvia? ¿Qué alternativas descartasteis y por qué?",
        "¿Qué preguntas deberíais haceros para someter esta idea a prueba antes de continuar: qué fallaría, qué asumimos, qué evidencia tenemos?",
        "¿Qué fuentes de información estáis usando para fundamentar vuestras decisiones?"
      ],
      desarrollo: [
        "¿Habéis aplicado algún test de validación: 5 Whys, análisis de riesgos, prueba de contrafactual ('¿qué pasa si...?')?",
        "¿Revisáis la coherencia interna: todas las partes encajan lógicamente, no hay contradicciones entre decisiones?",
        "¿Qué puntos de fallo habéis identificado y qué planes B habéis preparado para cada uno?",
        "¿Habéis designado a alguien como 'abogado del diablo' para argumentar en contra de la idea principal?",
        "¿Cómo detectáis sesgos grupales: desconexión de evidencias incómodas, presión de conformidad, exceso de confianza?",
        "¿Estáis considerando perspectivas diferentes o solo confirmando vuestras ideas iniciales?"
      ],
      cierre: [
        "¿Qué filtros aplicáis antes de entregar: viabilidad técnica, justificación sólida, completitud de requisitos?",
        "¿Revisáis posibles sesgos: estáis ignorando información incómoda, buscando sólo confirmación, subestimando riesgos?",
        "¿Habéis considerado alternativas no evaluadas: enfoques diferentes, soluciones más simples, cambios en el alcance?",
        "¿Cómo estructuraríais una autocrítica: 3 aciertos, 3 áreas de mejora, 3 aprendizajes concretos de este proyecto?",
        "¿Qué haríais diferente si tuvierais que repetir el proyecto?"
      ]
    }
  },

  /**
   * Unblocking Strategies
   * Generic strategies for stuck groups (not content-specific)
   */
  unblockingStrategies: [
    "¿Habéis considerado dividir el problema en partes más pequeñas y abordar una a una?",
    "¿Qué tal si generáis varias opciones sin decidir todavía?",
    "¿Os serviría un criterio temporal (por ejemplo, 'decidimos en 10 minutos') para avanzar?",
    "¿Podríais reformular la pregunta inicial para asegurar que todos entendéis el objetivo?",
    "¿Habéis pensado en priorizar las ideas antes de elegir una?"
  ],

  /**
   * Intervention Policy (for future autonomous interventions)
   * Currently only used for validation gate (≥3 participants)
   */
  interventionPolicy: {
    minMessagesBetweenInterventions: 5,
    maxInterventionsPerSession: 10,
    onlyInterveneWhenGatePassed: true,
    participationGateThreshold: 3  // Minimum distinct participants
  },

  /**
   * Pedagogical Objectives (CSCL)
   */
  objectives: {
    positiveInterdependence: true,
    individualAccountability: true,
    collaborativeSkills: true,
    metacognitiveRegulation: true,
    promotiveInteraction: true
  },

  /**
   * Peer Review Configuration (Coevaluación)
   * Used by /co_evaluar command
   */
  peerReview: {
    enabled: true,
    dimensions: [
      { id: "participation", label: "Participación activa", description: "¿El compañero/a contribuyó regularmente al trabajo del equipo?" },
      { id: "quality", label: "Calidad de aportaciones", description: "¿Las ideas y trabajos del compañero/a fueron útiles y bien elaborados?" },
      { id: "teamwork", label: "Actitud colaborativa", description: "¿Escuchó, respetó y apoyó a los demás miembros?" }
    ],
    scale: {
      min: 1,
      max: 5,
      labels: ["Muy mal", "Mal", "Regular", "Bien", "Excelente"]
    },
    requireComment: true,
    anonymousResults: false
  },

  /**
   * Session Phases (for teacher guidance, not enforced by bot)
   */
  sessionPhases: [
    { phase: 1, name: "Planificación", durationMinutes: 15, roleFocus: ["coordinator", "secretary"], teacherGuidance: "Definir objetivos, tareas y distribución de roles" },
    { phase: 2, name: "Desarrollo del trabajo", durationMinutes: 30, roleFocus: ["all"], teacherGuidance: "Investigación, discusión y producción colaborativa" },
    { phase: 3, name: "Síntesis y cierre", durationMinutes: 15, roleFocus: ["secretary", "critic"], teacherGuidance: "Resumen, revisión crítica y preparación de la presentación" }
  ],

  /**
   * Communication Style Guidelines
   */
  communicationStyle: {
    tone: "cercano, respetuoso, colaborativo, no paternalista, no evaluador",
    treatment: "tuteo (tratamiento 'tú', no 'usted')",
    register: "español de España (es-ES), natural y coloquial pero apropiado para el aula",
    facilitatorProfile: "Habla como un profesor que acompaña, no como un experto que sabe más"
  },

  /**
   * Intervention Templates (legacy / for reference)
   * These are static message templates, not used by AI responses
   */
  interventionTemplates: {
    coordinatorPrompt: "🤖 **Recordatorio de rol:** @Coordinador, ¿estáis avanzando según la planificación? ¿Alguien necesita ayuda para coordinar tareas?",
    secretaryPrompt: "🤖 **Pregunta al Secretario:** ¿Ya habéis resumido las ideas clave de esta discusión? Comparte el borrador con el equipo.",
    criticPrompt: "🤖 **Invitación al Crítico:** @Portavoz, ¿has identificado posibles fallos o alternativas? Es momento de someter las ideas a prueba.",
    participationGate: "⚠️ **Barrera de Cooperación:** Necesito ver que al menos 3 miembros del equipo están debatiendo antes de intervenir. ¡Involucrad a vuestros compañeros!",
    equityCheck: "🤔 **Observación:** Noto que algunas voces predominan más. ¿Cómo podemos asegurar que todos participen por igual?",
    metacognitive: "🧠 **Regulación:** ¿Han revisado los criterios de éxito? ¿Su enfoque es el correcto?"
  }
};
