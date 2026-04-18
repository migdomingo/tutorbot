/**
 * Scenario Configuration: Cooperative Project-Based Learning
 *
 * This scenario defines a pedagogical framework for cooperative project work
 * aligned with CSCL (Computer-Supported Collaborative Learning) principles
 * and the facilitator bot's regulatory interventions.
 *
 * Educational Context: Spanish 4th Year ESO (Educación Secundaria Obligatoria)
 * Subject: Cross-curricular project (e.g., Sciences, Technology, or Social Sciences)
 *
 * Pedagogical Foundation:
 * - Positive interdependence (Johnson & Johnson, 1999)
 * - Structured roles (coordinator, secretary, critic)
 * - Metacognitive regulation and peer evaluation
 * - Teacher scaffolding through AI agent (not content tutor)
 *
 * @file scenario_project.js
 * @author Miguel Ángel Domingo - Tutorbot Project
 * @institution Universidad Nebrija - TFG/TFM Research
 */

module.exports = {
  /**
   * Scenario Identifier
   * Unique name for this pedagogical configuration
   */
  name: "cooperative_project_basic",

  /**
   * Educational Level
   * Target educational stage for this scenario
   */
  educationalLevel: "4th_ESO", // Educación Secundaria Obligatoria, Spain

  /**
   * Task Type
   * Nature of the cooperative work
   * - 'project': Long-term, product-oriented collaborative task
   * - 'problem_solving': Case study or problem to be solved collaboratively
   * - 'debate': Argumentative discussion with structured positions
   */
  taskType: "project", // Proyecto cooperativo a mediano plazo

  /**
   * Pedagogical Objectives (CSCL-Aligned)
   * Core learning goals focused on process regulation, NOT content delivery
   */
  objectives: {
    /**
     * Positive Interdependence
     * Team members rely on each other's contributions to succeed
     */
    positiveInterdependence: true,

    /**
     * Individual Accountability
     * Each member must contribute; tracked through peer review
     */
    individualAccountability: true,

    /**
     * Collaborative Skills Development
     * Explicit training in teamwork, communication, conflict resolution
     */
    collaborativeSkills: true,

    /**
     * Group Processing / Metacognition
     * Teams reflect on their working process and improve it
     */
    metacognitiveRegulation: true,

    /**
     * Face-to-Face Promotive Interaction
     * Encouraged through structured roles and turn-taking norms
     */
    promotiveInteraction: true
  },

  /**
   * Cooperative Roles (Fixed for the session)
   * Each role has specific responsibilities and intervention triggers
   */
  roles: [
    {
      id: "coordinator",
      displayName: "Coordinador/a / Scrum Master",
      responsibilities: [
        "Gestionar el tiempos y la agenda de trabajo",
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
      displayName: "Secretario/a / Escriba",
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
      displayName: "Portavoz / Crítico/a Constructivo",
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
   * Intervention Types Taxonomy
   * Defines which regulatory interventions are allowed in this scenario
   * Content tutoring is ALWAYS forbidden regardless of config
   */
  interventionTypes: {
    process_monitoring: {
      active: true,
      label: "Monitorización del proceso",
      description: "Observa el avance del trabajo y detecta desviaciones",
      promptExample: "¿Lleváis un ritmo adecuado? ¿Qué os falta por hacer?"
    },
    role_coordination: {
      active: true,
      label: "Coordinación por roles",
      description: "Activa a los miembros según su rol asignado",
      promptExample: "Coordinador, reparte las tareas. Secretario, toma nota."
    },
    sociocognitive_conflict: {
      active: true,
      label: "Conflicto sociocognitivo",
      description: "Provoca disonancia constructiva para profundizar",
      promptExample: "¿Estáis seguros? ¿No hay otra forma de ver este problema?"
    },
    final_reflection: {
      active: false,
      label: "Reflexión final de cierre",
      description: "Síntesis metacognitiva al final de la sesión",
      pendingImplementation: true
    },
    content_tutoring: {
      active: false,
      label: "Tutoría de contenidos académicos",
      description: "Resolver problemas de matemáticas, ciencias, etc.",
      forbidden: true
    }
  },

  /**
   * Intervention Frequency Configuration
   * How often the bot should intervene (to avoid over-scaffolding)
   */
  interventionPolicy: {
    minMessagesBetweenInterventions: 5, // Esperar al menos 5 mensajes antes de intervenir
    maxInterventionsPerSession: 10,     // Límite por sesión para no dominar
    onlyInterveneWhenGatePassed: true   // Solo si hay ≥3 participantes
  },

  /**
   * Peer Review Configuration (Coevaluación)
   * Settings for the /coevaluate command in this scenario
   */
  peerReview: {
    enabled: true,
    dimensions: [
      {
        id: "participation",
        label: "Participación activa",
        description: "¿El compañero/a contribuyó regularmente al trabajo del equipo?"
      },
      {
        id: "quality",
        label: "Calidad de aportaciones",
        description: "¿Las ideas y trabajos del compañero/a fueron útiles y bien elaborados?"
      },
      {
        id: "teamwork",
        label: "Actitud colaborativa",
        description: "¿Escuchó, respetó y apoyó a los demás miembros?"
      }
    ],
    scale: {
      min: 1,
      max: 5,
      labels: ["Muy mal", "Mal", "Regular", "Bien", "Excelente"]
    },
    requireComment: true, // Justificación obligatoria
    anonymousResults: false // Visible para el profesorado
  },

  /**
   * Session Structure (Template)
   * Suggested phases for a cooperative project session
   * NOT enforced by bot, but recommended for teacher planning
   */
  sessionPhases: [
    {
      phase: 1,
      name: "Planificación",
      durationMinutes: 15,
      roleFocus: ["coordinator", "secretary"],
      teacherGuidance: "Definir objetivos, tareas y distribución de roles"
    },
    {
      phase: 2,
      name: "Desarrollo del trabajo",
      durationMinutes: 30,
      roleFocus: ["all"],
      teacherGuidance: "Investigación, discusión y producción colaborativa"
    },
    {
      phase: 3,
      name: "Síntesis y cierre",
      durationMinutes: 15,
      roleFocus: ["secretary", "critic"],
      teacherGuidance: "Resumen, revisión crítica y preparación de la presentación"
    }
  ],

  /**
   * Evaluation Criteria (for teacher reference)
   * Dimensions to assess both the product AND the process
   */
  evaluationCriteria: {
    productQuality: "Calidad académica del resultado final",
    collaborationProcess: "Grado de cumplimiento de principios cooperativos",
    individualContribution: "Evidenciado mediante coevaluación entre pares",
    metacognitiveReflection: "Capacidad de analizar y mejorar su propio trabajo en equipo"
  },

  /**
   * Sample Preguntas Reguladoras (in Spanish - static texts)
   * These are the actual intervention phrases the bot will use
   * (Content remains in Spanish as requested)
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
