require('dotenv').config();
const { 
    Client, GatewayIntentBits, REST, Routes, 
    PermissionFlagsBits, Events 
} = require('discord.js');
const { OpenAI } = require('openai');
const { 
    dbInitialize, 
    clearChannelData, 
    upsertRole, 
    insertPeerReview, 
    insertSurveyResult, 
    insertParticipationLog,
    getRoles
} = require('./commons/db.js');
const { commands } = require('./commons/commands.js');
const { handleCollaborativeHelpCommand } = require('./collaborative/help.js');
const { handleCooperativeHelpCommand, handleAutomaticMilestoneIntervention } = require('./cooperative/help.js');

// Determine mode from environment variable or command line argument
const args = process.argv.slice(2);
let modeFromArg = null;
for (const arg of args) {
  if (arg.startsWith('mode=')) {
    modeFromArg = arg.split('=')[1];
    break;
  }
}
const mode = process.env.BOT_MODE || modeFromArg || 'collaborative';
console.log(`🤖 Bot iniciado en modo: ${mode}`);

const openai = new OpenAI({ 
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1" 
});

dbInitialize();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Deploy slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
        console.log(`✅ ${mode} Commands Registered`);
    } catch (err) { console.error(err); }
})();

// Interaction handlers (slash commands)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'reset') {
        clearChannelData(interaction.channelId);
        return interaction.reply({
            content: '🧹 Datos de análisis del canal eliminados: solicitudes de ayuda, participación, intervenciones del bot y coevaluaciones.',
            ephemeral: false
        });
    }

    if (interaction.commandName === 'asignar_roles') {
        const roles = [
            { id: interaction.options.getUser('lider').id, name: 'Coordinador/Scrum Master', user: interaction.options.getUser('lider').username },
            { id: interaction.options.getUser('secretario').id, name: 'Secretario/Scribe', user: interaction.options.getUser('secretario').username },
            { id: interaction.options.getUser('critico').id, name: 'Portavoz/Crítico', user: interaction.options.getUser('critico').username }
        ];

        clearChannelData(interaction.channelId);
        for (const r of roles) {
            await upsertRole(interaction.channelId, r.id, r.user, r.name);
        }

        return interaction.reply(`👥 **Roles de Equipo Asignados:**\n` + 
            roles.map(r => `• **${r.name}**: ${r.user}`).join('\n') + 
            `\n\n🧹 Datos de análisis anteriores limpiados.`);
    }

    if (interaction.commandName === 'co_evaluar') {
        const student = interaction.options.getUser('estudiante');
        const score = interaction.options.getInteger('nota');
        const comment = interaction.options.getString('comentario');

        if (student.id === interaction.user.id) {
            return interaction.reply({ content: 'No puedes evaluarte a ti mismo.', ephemeral: true });
        }

        try {
            await insertPeerReview(interaction.channelId, interaction.user.id, student.id, score, comment);
            return interaction.reply({ content: `✅ Has evaluado a **${student.username}** con un ${score}/5.`, ephemeral: true });
        } catch (err) {
            console.error('Error saving peer review:', err);
            return interaction.reply('Error al guardar coevaluación.');
        }
    }

    if (interaction.commandName === 'encuesta') {
        const q1 = interaction.options.getInteger('utilidad');
        const q2 = interaction.options.getInteger('colaboracion');
        const q3 = interaction.options.getInteger('facilidad');
        const comment = interaction.options.getString('comentario');

        try {
            await insertSurveyResult(interaction.channelId, interaction.user.id, interaction.user.username, q1, q2, q3, comment);
            return interaction.reply({ content: '✅ ¡Gracias! Tu opinión es fundamental para mi investigación (TFM).', ephemeral: true });
        } catch (err) {
            console.error('Error saving survey:', err);
            return interaction.reply({ content: '❌ Error al guardar la encuesta.', ephemeral: true });
        }        
    }
    
    if (interaction.commandName === 'forzar_ayuda') {
        const fakeMessage = {
            channelId: interaction.channelId,
            author: { id: interaction.user.id, username: interaction.user.username, bot: false },
            content: '!ayuda (forzado por docente)',
            channel: {
                messages: {
                    fetch: async () => interaction.channel.messages.fetch({ limit: 20 })
                }
            },
            reply: async (content) => interaction.reply({ content, ephemeral: false })
        };
        
        try {
            if (mode === 'collaborative') {
                await handleCollaborativeHelpCommand(fakeMessage, openai, true);
            } else if (mode === 'cooperative') {
                await handleCooperativeHelpCommand(fakeMessage, openai, true);
            }
        } catch (err) {
            console.error('Error en forzar_ayuda:', err);
            interaction.reply({ content: '❌ Error al procesar la solicitud.', ephemeral: true });
        }
        return;
    }
});

// Message handler: delegar !ayuda a help.js
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    // Log participation
    try {
        await insertParticipationLog(message.channelId, message.author.id, message.author.username);
    } catch (error) {
        console.error('Error logging participation:', error);
    }

    // Comando !informe_docente (comentado, no funcional)
    if (message.content === '!informe_docente') {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Comando solo para administradores/profesores.');
        }
        message.reply('🔄 Generando informe...');
        return;
    }

    // Delegar !ayuda al módulo help.js        
    if (message.content.startsWith('!ayuda')) {
        if (mode === 'collaborative') {
            return handleCollaborativeHelpCommand(message, openai);
        }
        if (mode === 'cooperative') {
            return handleCooperativeHelpCommand(message, openai);
        }
    } else if (mode === 'cooperative' && !message.author.bot) {
        const roles = await getRoles(message.channelId);
        if (!roles || roles.length === 0) return;
        await handleAutomaticMilestoneIntervention(message, roles);
    }
});

client.login(process.env.DISCORD_TOKEN);
