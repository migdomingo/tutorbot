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
    getRoles,
    upsertActivityContext,
    getChannelStats,
    insertTeacherAssessment
} = require('./commons/db.js');
const { getMode } = require('./config');
const { commands } = require('./commons/commands.js');
const { handleCollaborativeHelpCommand } = require('./collaborative/help.js');
const { handleCooperativeHelpCommand, handleAutomaticMilestoneIntervention } = require('./cooperative/help.js');

const mode = getMode();
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

    if (interaction.commandName === 'configurar_actividad') {
        if (mode !== 'cooperative') {
            return interaction.reply({
                content: '⚠️ El comando `/configurar_actividad` solo está disponible en modo cooperativo. El bot está actualmente en modo **colaborativo**.',
                ephemeral: true
            });
        }
        const domain = interaction.options.getString('dominio');
        const topic = interaction.options.getString('tema');
        const taskType = interaction.options.getString('tipo_tarea');
        const partesStr = interaction.options.getString('partes');

        let partes = [];
        let mapeoRoles = {};

        try {
            partes = partesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
            
            mapeoRoles['coordinator'] = 'coordina el proceso, no desarrolla partes';
            for (let i = 0; i < partes.length; i++) {
                if (i === partes.length - 1 && partes.length > 1) {
                    mapeoRoles['supervisor'] = partes[i];
                } else if (i === partes.length - 1 && partes.length === 1) {
                    mapeoRoles['task1'] = partes[i];
                    mapeoRoles['supervisor'] = 'responsable de revisión e integración final y última tarea'; // Default if only 1 part
                } else {
                    mapeoRoles[`task${i+1}`] = partes[i];
                }
            }
        } catch (e) {
            return interaction.reply({
                content: '❌ Error: Ocurrió un error al procesar las partes introducidas.',
                ephemeral: true
            });
        }

        try {
            await upsertActivityContext(interaction.channelId, domain, topic, taskType, partes, mapeoRoles);
            return interaction.reply({
                content: `✅ Contexto de actividad cooperativa configurado con éxito.\n**Tema:** ${topic}\n**Partes:** ${partes.join(', ')}\n**Mapeo Generado:** ${JSON.stringify(mapeoRoles, null, 2)}`,
                ephemeral: false
            });
        } catch (err) {
            console.error('Error saving activity context:', err);
            return interaction.reply({ content: '❌ Error al guardar el contexto de la actividad.', ephemeral: true });
        }
    }


    if (interaction.commandName === 'asignar_roles') {
        if (mode !== 'collaborative') {
            return interaction.reply({
                content: '⚠️ El comando `/asignar_roles` solo está disponible en modo colaborativo. Usa `/asignar_roles_cooperativo` en modo cooperativo.',
                ephemeral: true
            });
        }
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

    if (interaction.commandName === 'asignar_roles_cooperativo') {
        if (mode !== 'cooperative') {
            return interaction.reply({
                content: '⚠️ El comando `/asignar_roles_cooperativo` solo está disponible en modo cooperativo. Usa `/asignar_roles` en modo colaborativo.',
                ephemeral: true
            });
        }
        const coord = interaction.options.getUser('coordinador');
        const superv = interaction.options.getUser('supervisor');
        const t1 = interaction.options.getUser('tarea1');
        const t2 = interaction.options.getUser('tarea2');
        const t3 = interaction.options.getUser('tarea3');
        const t4 = interaction.options.getUser('tarea4');
        const t5 = interaction.options.getUser('tarea5');

        const rolesToAssign = [
            { id: coord.id, name: 'coordinator', user: coord.username, display: 'Coordinador/a' },
            { id: superv.id, name: 'supervisor', user: superv.username, display: 'Supervisor/a' },
            { id: t1.id, name: 'task1', user: t1.username, display: 'Responsable Tarea 1' },
            { id: t2.id, name: 'task2', user: t2.username, display: 'Responsable Tarea 2' }
        ];

        if (t3) rolesToAssign.push({ id: t3.id, name: 'task3', user: t3.username, display: 'Responsable Tarea 3' });
        if (t4) rolesToAssign.push({ id: t4.id, name: 'task4', user: t4.username, display: 'Responsable Tarea 4' });
        if (t5) rolesToAssign.push({ id: t5.id, name: 'task5', user: t5.username, display: 'Responsable Tarea 5' });

        clearChannelData(interaction.channelId);
        for (const r of rolesToAssign) {
            await upsertRole(interaction.channelId, r.id, r.user, r.name);
        }

        return interaction.reply(`👥 **Roles Requeridos Asignados (Cooperativo):**\n` + 
            rolesToAssign.map(r => `• **${r.display}**: ${r.user}`).join('\n') + 
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
    
    if (interaction.commandName === 'informe_cooperacion') {
        await interaction.deferReply();
        try {
            const stats = await getChannelStats(interaction.channelId);

            const rolesText = stats.roles.length > 0
                ? stats.roles.map(r => `• **${r.role_name}**: ${r.username}`).join('\n')
                : '_Sin roles asignados._';

            const participacionText = stats.participation.length > 0
                ? stats.participation.map(p => `• ${p.username}: ${p.msg_count} mensajes`).join('\n')
                : '_Sin actividad registrada._';

            const intervencionesText = stats.interventions.length > 0
                ? stats.interventions.map(i => `• ${i.intervention_type}: ${i.count}`).join('\n')
                : '_Sin intervenciones del bot._';

            const avgScore = stats.peerReviews.length > 0
                ? (stats.peerReviews.reduce((a, b) => a + b.score, 0) / stats.peerReviews.length).toFixed(1)
                : null;
            const coevalText = avgScore
                ? `${stats.peerReviews.length} coevaluaciones registradas. Media: ${avgScore}/5`
                : '_Sin coevaluaciones registradas._';

            const report = [
                `📊 **Informe de Cooperación**`,
                ``,
                `👥 **Roles asignados:**\n${rolesText}`,
                ``,
                `📈 **Participación:**\n${participacionText}`,
                ``,
                `🆘 **Solicitudes de ayuda (!ayuda):** ${stats.helpCount}`,
                ``,
                `⚡ **Intervenciones del bot:**\n${intervencionesText}`,
                ``,
                `🌟 **Coevaluación entre pares:** ${coevalText}`
            ].join('\n');

            return interaction.editReply(report.slice(0, 1990));
        } catch (err) {
            console.error('[INFORME_COOP] Error:', err);
            return interaction.editReply('❌ Error al generar el informe.');
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

    if (message.content === '!informe_docente') {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Comando solo para administradores/profesores.');
        }
        const statusMsg = await message.reply('🔄 Generando informe pedagógico con IA...');
        try {
            const stats = await getChannelStats(message.channelId);
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
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `Eres un asistente pedagógico. Genera un informe de seguimiento grupal para el docente a partir de métricas de proceso de un bot educativo. Devuelve SOLO un objeto JSON con exactamente estos campos: participation_summary, regulation_summary, collaboration_summary, strengths, improvement_suggestions, overall_assessment. Cada campo: máximo 2 frases. Idioma: español de España.`
                    },
                    { role: "user", content: `Métricas del grupo (modo ${mode}):\n${statsText}` }
                ]
            });

            const assessment = JSON.parse(completion.choices[0].message.content);
            await insertTeacherAssessment(message.channelId, assessment, mode);

            const report = [
                `📋 **Informe Pedagógico** _(guardado en BD)_`,
                ``,
                `👥 **Participación:** ${assessment.participation_summary}`,
                `📊 **Regulación:** ${assessment.regulation_summary}`,
                `🤝 **Colaboración:** ${assessment.collaboration_summary}`,
                `✨ **Fortalezas:** ${assessment.strengths}`,
                `💡 **Mejoras:** ${assessment.improvement_suggestions}`,
                `📝 **Valoración global:** ${assessment.overall_assessment}`
            ].join('\n');

            return statusMsg.edit(report.slice(0, 1990));
        } catch (err) {
            console.error('[INFORME_DOCENTE] Error:', err);
            return statusMsg.edit('❌ Error al generar el informe. Comprueba que hay datos de participación en este canal.');
        }
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
        await handleAutomaticMilestoneIntervention(message, roles, openai);
    }
});

client.login(process.env.DISCORD_TOKEN);
