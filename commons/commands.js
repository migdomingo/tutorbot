const { 
    SlashCommandBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

// --- 3. SLASH COMMANDS ---
const commands = [
    // Command to reset analysis data for current channel (admin only)
    new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Limpia los datos de análisis de este canal (solo administradores)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // Command to assign roles to the team
    new SlashCommandBuilder()
        .setName('asignar_roles')
        .setDescription('Asigna roles de aprendizaje colaborativo a los miembros')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(opt => opt.setName('lider').setDescription('Coordinador/Scrum Master').setRequired(true))
        .addUserOption(opt => opt.setName('secretario').setDescription('Secretario/Scribe').setRequired(true))
        .addUserOption(opt => opt.setName('critico').setDescription('Portavoz/Crítico').setRequired(true)),
        
    // Command to assign roles to the team for cooperative mode
    new SlashCommandBuilder()
        .setName('asignar_roles_cooperativo')
        .setDescription('Asigna roles de aprendizaje cooperativo a los miembros (mínimo 4)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(opt => opt.setName('coordinador').setDescription('Coordinador/a').setRequired(true))
        .addUserOption(opt => opt.setName('supervisor').setDescription('Supervisor/a').setRequired(true))
        .addUserOption(opt => opt.setName('tarea1').setDescription('Responsable Tarea 1').setRequired(true))
        .addUserOption(opt => opt.setName('tarea2').setDescription('Responsable Tarea 2').setRequired(true))
        .addUserOption(opt => opt.setName('tarea3').setDescription('Responsable Tarea 3').setRequired(false))
        .addUserOption(opt => opt.setName('tarea4').setDescription('Responsable Tarea 4').setRequired(false))
        .addUserOption(opt => opt.setName('tarea5').setDescription('Responsable Tarea 5').setRequired(false)),

    // Command for Peer Review (Coevaluación)
    new SlashCommandBuilder()
        .setName('co_evaluar')
        .setDescription('Evalúa el trabajo de un compañero de equipo')
        .addUserOption(opt => opt.setName('estudiante').setDescription('Compañero a evaluar').setRequired(true))
        .addIntegerOption(opt => opt.setName('nota').setDescription('Nota del 1 al 5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption(opt => opt.setName('comentario').setDescription('Justifica tu valoración').setRequired(true)),

    // Teacher command to see the collaboration report
    new SlashCommandBuilder()
        .setName('informe_cooperacion')
        .setDescription('Muestra el estado de colaboración y coevaluaciones')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    // Teacher command to force intervention
    new SlashCommandBuilder()
        .setName('forzar_ayuda')
        .setDescription('Fuerza la intervención del facilitador (docente/admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('encuesta')
        .setDescription('Responde a la encuesta de percepción sobre la IA')
        .addIntegerOption(opt => opt.setName('utilidad').setDescription('¿Te ayudó a aprender? (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption(opt => opt.setName('colaboracion').setDescription('¿Te obligó a colaborar más? (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption(opt => opt.setName('facilidad').setDescription('¿Fue fácil de usar? (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption(opt => opt.setName('comentario').setDescription('¿Qué mejorarías?').setRequired(true)),
        
    // Command for cooperative activity context
    new SlashCommandBuilder()
        .setName('configurar_actividad')
        .setDescription('Configura el contexto de la actividad cooperativa')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(opt => 
            opt.setName('dominio')
               .setDescription('Dominio de conocimiento')
               .setRequired(true)
               .addChoices(
                   { name: 'Tecnología', value: 'technology' },
                   { name: 'Matemáticas', value: 'mathematics' },
                   { name: 'Historia', value: 'history' },
                   { name: 'Otro', value: 'other' }
               )
        )
        .addStringOption(opt => opt.setName('tema').setDescription('Descripción breve de la actividad').setRequired(true))
        .addStringOption(opt => 
            opt.setName('tipo_tarea')
               .setDescription('Tipo de la tarea')
               .setRequired(true)
               .addChoices(
                   { name: 'Documento Estructurado', value: 'structured_document' },
                   { name: 'Solución de Problemas', value: 'problem_solution' },
                   { name: 'Diseño Técnico', value: 'technical_design' },
                   { name: 'Otro', value: 'other' }
               )
        )
        .addStringOption(opt => opt.setName('partes').setDescription('Lista de partes requeridas separadas por comas').setRequired(true)),
].map(cmd => cmd.toJSON());

module.exports = { commands };