/**
 * Pedagogical Configuration for Cooperative Learning Mode
 * Structured cooperative learning with defined roles and milestones
 */
/**
 * Scenario Configuration – Cooperative Learning Mode
 * ---------------------------------------------------
 * Pedagogical configuration for the COOPERATIVE chatbot.
 * Focus:
 * - Structured cooperative learning
 * - Explicit interdependence
 * - Strict roles and responsibilities
 * - Process coordination and task completion
 *
 * Educational level: 4º ESO
 *
 * This configuration MUST NOT include:
 * - Metacognitive debate
 * - Idea quality analysis
 * - Conflict sociocognitivo
 */

module.exports = {

  /* =====================================================
   * SCENARIO METADATA
   * ===================================================== */
  name: "cooperative_structured_work",
  educationalLevel: "4th_ESO",
  taskType: "structured_cooperative_task",

  /* =====================================================
   * PROCESS PHASES (STRICT SEQUENCE)
   * ===================================================== */
  phases: {
    order: ["inicio", "desarrollo", "revision", "cierre"],

    descriptions: {
      inicio: "Asignación de roles y reparto de tareas",
      desarrollo: "Trabajo individual sobre la parte asignada",
      revision: "Revisión cruzada e integración",
      cierre: "Comprobación final y preparación de entrega"
    }
  },

  /* =====================================================
   * ROLE DEFINITIONS (STRICT RESPONSIBILITIES)
   * ===================================================== */
  roles: {
    coordinator: {
      displayName: "Coordinador/a",
      strict: true,
      responsibilities: [
        "Coordinar el proceso",
        "No desarrolla partes"
      ],
      allowedInterventions: [
        "reparto_de_tareas",
        "control_de_fases",
        "recordatorio_de_plazos"
      ]
    },

    task1: {
      displayName: "Responsable de Tarea 1",
      strict: true,
      responsibilities: [
        "Responsable de la parte 1",
        "Responder a revisiones o correcciones"
      ],
      allowedInterventions: [
        "verificacion_de_completitud"
      ]
    },

    task2: {
      displayName: "Responsable de Tarea 2",
      strict: true,
      responsibilities: [
        "Responsable de la parte 2",
        "Ajustar su parte tras la revisión"
      ],
      allowedInterventions: [
        "verificacion_de_completitud",
        "sincronizacion_de_partes"
      ]
    },

    task3: {
      displayName: "Responsable de Tarea 3",
      strict: true,
      responsibilities: [
        "Responsable de la parte 3",
        "Ajustar su parte tras la revisión"
      ],
      allowedInterventions: [
        "verificacion_de_completitud",
        "sincronizacion_de_partes"
      ]
    },

    task4: {
      displayName: "Responsable de Tarea 4",
      strict: true,
      responsibilities: [
        "Responsable de la parte 4",
        "Ajustar su parte tras la revisión"
      ],
      allowedInterventions: [
        "verificacion_de_completitud",
        "sincronizacion_de_partes"
      ]
    },

    task5: {
      displayName: "Responsable de Tarea 5",
      strict: true,
      responsibilities: [
        "Responsable de la parte 5",
        "Ajustar su parte tras la revisión"
      ],
      allowedInterventions: [
        "verificacion_de_completitud",
        "sincronizacion_de_partes"
      ]
    },

    supervisor: {
      displayName: "Supervisor/a",
      strict: true,
      responsibilities: [
        "Responsable de revisión e integración final",
        "Responsable de última tarea asignada"
      ],
      allowedInterventions: [
        "revision_final",
        "control_de_calidad"
      ]
    }
  },

  /* =====================================================
   * AUTOMATIC PROCESS MILESTONES (ALLOWED)
   * ===================================================== */
  automaticMilestones: {
    enabled: true,

    milestones: [
      {
        id: "START",
        phase: "inicio",
        messagePolicy: "recordatorio_roles",
        description: "Confirmar que todos conocen su responsabilidad"
      },
      {
        id: "MIDPOINT",
        phase: "desarrollo",
        messagePolicy: "comprobacion_progreso",
        description: "Verificar que todas las tareas están avanzando"
      },
      {
        id: "PRE_CLOSE",
        phase: "revision",
        messagePolicy: "verificacion_integracion",
        description: "Asegurar que alguien revisa la integración final"
      }
    ]
  },

  /* =====================================================
   * INTERVENTION RULES (VERY IMPORTANT)
   * ===================================================== */
  interventionPolicy: {
    underDemandAllowed: true,
    automaticAllowed: true,

    strictRules: {
      noAcademicContent: true,
      noSolutionProviding: true,
      noEvaluation: true,
      noInterpretativeDebate: true
    }
  },

  /* =====================================================
   * PERMITTED INTERVENTION TYPES
   * ===================================================== */
  allowedInterventions: [
    "task_management",
    "role_reminder",
    "phase_transition",
    "progress_check",
    "integration_check"
  ],

  /* =====================================================
   * COMMUNICATION STYLE (DIFFERENT FROM COLLABORATIVE)
   * ===================================================== */
  communicationStyle: {
    tone: "claro, neutral, organizativo",
    register: "español de España (es-ES), directo y respetuoso",
    facilitatorProfile: "Gestor del proceso, no mediador cognitivo",
    maxLength: "2-3 líneas",
    questionStyle: "cerradas o de verificación, no abiertas metacognitivas"
  },

  /* =====================================================
   * PEDAGOGICAL OBJECTIVES (COOPERATIVE)
   * ===================================================== */
  objectives: {
    positiveInterdependence: true,
    individualAccountability: true,
    taskCompletion: true,
    coordinationEfficiency: true,
    sharedResponsibility: true
  },


  /**
   * Intervention Policy
   * Defines when and how the bot can intervene
   */
  intervention_policy: "on_demand_plus_milestones",

  /**
   * Role Strictness
   * How strictly roles are enforced
   */
  role_strictness: "strict",

  /**
   * Allowed Intervention Types
   * Types of interventions the bot can perform
   */
  allowed_interventions: [
    "coordination",
    "task_management", 
    "review_checks"
  ],

  /**
   * Automatic Interventions Enabled
   * Whether the bot can intervene without explicit request
   * (Set to true but actual automatic interventions not implemented yet)
   */
  automatic_interventions_enabled: true
};