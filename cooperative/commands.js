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
        .setDescription('Asigna roles de aprendizaje cooperativo a los miembros')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(opt => opt.setName('lider').setDescription('Coordinador/Scrum Master').setRequired(true))
        .addUserOption(opt => opt.setName('secretario').setDescription('Secretario/Scribe').setRequired(true))
        .addUserOption(opt => opt.setName('critico').setDescription('Portavoz/Crítico').setRequired(true)),

    // Command for Peer Review (Coevaluación)
    new SlashCommandBuilder()
        .setName('co_evaluar')
        .setDescription('Evalúa el trabajo de un compañero de equipo')
        .addUserOption(opt => opt.setName('estudiante').setDescription('Compañero a evaluar').setRequired(true))
        .addIntegerOption(opt => opt.setName('nota').setDescription('Nota del 1 al 5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption(opt => opt.setName('comentario').setDescription('Justifica tu valoración').setRequired(true)),

    // Teacher command to see the cooperation report
    new SlashCommandBuilder()
        .setName('informe_cooperacion')
        .setDescription('Muestra el estado de colaboración y coevaluaciones')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('encuesta')
        .setDescription('Responde a la encuesta de percepción sobre la IA')
        .addIntegerOption(opt => opt.setName('utilidad').setDescription('¿Te ayudó a aprender? (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption(opt => opt.setName('colaboracion').setDescription('¿Te obligó a colaborar más? (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption(opt => opt.setName('facilidad').setDescription('¿Fue fácil de usar? (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption(opt => opt.setName('comentario').setDescription('¿Qué mejorarías?').setRequired(true)),
].map(cmd => cmd.toJSON());

module.exports = { commands };