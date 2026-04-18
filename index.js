require('dotenv').config();
const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    PermissionFlagsBits, Events, EmbedBuilder 
} = require('discord.js');
const { OpenAI } = require('openai');
const sqlite3 = require('sqlite3').verbose();
const scenarioConfig = require('./scenarios/scenario_project.js');

// --- 1. SETTINGS ---
const openai = new OpenAI({ 
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1" 
});

const db = new sqlite3.Database('./cooperative_learning.sqlite');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// --- 2. DATABASE SCHEMA (Cooperative Focus) ---
db.serialize(() => {
    // Stores specific roles within a team/channel
    db.run(`CREATE TABLE IF NOT EXISTS team_roles (
        channel_id TEXT,
        user_id TEXT,
        username TEXT,
        role_name TEXT,
        PRIMARY KEY (channel_id, user_id)
    )`);

    // Stores Peer-to-Peer evaluations (Coevaluación)
    db.run(`CREATE TABLE IF NOT EXISTS peer_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT,
        reviewer_id TEXT,
        reviewee_id TEXT,
        score INTEGER,
        comment TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Stores survey responses (1-5 scales)
    db.run(`CREATE TABLE IF NOT EXISTS survey_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        username TEXT,
        q1_utility INTEGER,
        q2_interdependence INTEGER,
        q3_ease_of_use INTEGER,
        q4_open_comment TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// --- 3. SLASH COMMANDS ---
const commands = [
    // Command to assign roles to the team
    new SlashCommandBuilder()
        .setName('assign_roles')
        .setDescription('Asigna roles de aprendizaje cooperativo a los miembros')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(opt => opt.setName('leader').setDescription('Coordinador/Scrum Master').setRequired(true))
        .addUserOption(opt => opt.setName('secretary').setDescription('Secretario/Scribe').setRequired(true))
        .addUserOption(opt => opt.setName('critic').setDescription('Portavoz/Crítico').setRequired(true)),

    // Command for Peer Review (Coevaluación)
    new SlashCommandBuilder()
        .setName('coevaluate')
        .setDescription('Evalúa el trabajo de un compañero de equipo')
        .addUserOption(opt => opt.setName('student').setDescription('Compañero a evaluar').setRequired(true))
        .addIntegerOption(opt => opt.setName('score').setDescription('Nota del 1 al 5').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption(opt => opt.setName('comment').setDescription('Justifica tu valoración').setRequired(true)),

    // Teacher command to see the cooperation report
    new SlashCommandBuilder()
        .setName('coop_report')
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

// Deploy Commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
        console.log('✅ Cooperative Commands Registered');
    } catch (err) { console.error(err); }
})();

// --- 4. INTERACTION HANDLERS ---

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Handle Role Assignment
    if (interaction.commandName === 'assign_roles') {
        const roles = [
            { id: interaction.options.getUser('leader').id, name: 'Coordinador/Scrum Master', user: interaction.options.getUser('leader').username },
            { id: interaction.options.getUser('secretary').id, name: 'Secretario/Scribe', user: interaction.options.getUser('secretary').username },
            { id: interaction.options.getUser('critic').id, name: 'Portavoz/Crítico', user: interaction.options.getUser('critic').username }
        ];

        roles.forEach(r => {
            db.run(`INSERT OR REPLACE INTO team_roles VALUES (?, ?, ?, ?)`, [interaction.channelId, r.id, r.user, r.name]);
        });

        await interaction.reply(`👥 **Roles de Equipo Asignados:**\n` + roles.map(r => `• **${r.name}**: ${r.user}`).join('\n'));
    }

    // Handle Peer Review
    if (interaction.commandName === 'coevaluate') {
        const student = interaction.options.getUser('student');
        const score = interaction.options.getInteger('score');
        const comment = interaction.options.getString('comment');

        if (student.id === interaction.user.id) return interaction.reply({ content: 'No puedes evaluarte a ti mismo.', ephemeral: true });

        db.run(`INSERT INTO peer_reviews (channel_id, reviewer_id, reviewee_id, score, comment) VALUES (?, ?, ?, ?, ?)`,
            [interaction.channelId, interaction.user.id, student.id, score, comment],
            (err) => {
                if (err) return interaction.reply('Error al guardar coevaluación.');
                interaction.reply({ content: `✅ Has evaluado a **${student.username}** con un ${score}/5.`, ephemeral: true });
            }
        );
    }

    if (interaction.commandName === 'encuesta') {
        const q1 = interaction.options.getInteger('utilidad');
        const q2 = interaction.options.getInteger('colaboracion');
        const q3 = interaction.options.getInteger('facilidad');
        const comment = interaction.options.getString('comentario');

        db.run(`INSERT INTO survey_results (user_id, username, q1_utility, q2_interdependence, q3_ease_of_use, q4_open_comment) VALUES (?, ?, ?, ?, ?, ?)`,
        [interaction.user.id, interaction.user.username, q1, q2, q3, comment],
        (err) => {
            if (err) return interaction.reply({ content: '❌ Error al guardar la encuesta.', ephemeral: true });
            interaction.reply({ content: '✅ ¡Gracias! Tu opinión es fundamental para mi investigación (TFM).', ephemeral: true });
        }
    );
}
});

// --- 5. AI ORCHESTRATOR WITH INTERDEPENDENCE GATE ---

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.content.startsWith('!ayuda')) return;

    // 1. Check Participation Gate (Positive Interdependence)
    const messages = await message.channel.messages.fetch({ limit: 20 });
    const recentAuthors = new Set(messages.filter(m => !m.author.bot).map(m => m.author.id));

    if (recentAuthors.size < 3) {
        return message.reply("⚠️ **Barrera de Cooperación:** Necesito ver que al menos 3 miembros del equipo están debatiendo antes de intervenir. ¡Involucrad a vuestros compañeros!");
    }

    // 2. Get Team Roles for Context
        db.all(`SELECT username, role_name FROM team_roles WHERE channel_id = ?`, [message.channelId], async (err, roles) => {
            const rolesList = roles.map(r => `${r.username} es el ${r.name}`).join(', ');

            // Build allowed interventions list from scenario config
            const allowedTypes = Object.entries(scenarioConfig.interventionTypes)
                .filter(([key, config]) => config.active && !config.pendingImplementation)
                .map(([key, config]) => `- ${config.label} (ej: "${config.promptExample}")`)
                .join('\n');

            // Build prohibited interventions list
            const prohibitedTypes = Object.entries(scenarioConfig.interventionTypes)
                .filter(([key, config]) => !config.active && !config.pendingImplementation && !config.forbidden)
                .map(([key, config]) => `- ${config.label}`)
                .join('\n');

            // Build pending/forbidden interventions
            const pendingTypes = Object.entries(scenarioConfig.interventionTypes)
                .filter(([key, config]) => config.pendingImplementation)
                .map(([key, config]) => `- [FUTURO] ${config.label}`)
                .join('\n');

            const forbiddenTypes = Object.entries(scenarioConfig.interventionTypes)
                .filter(([key, config]) => config.forbidden)
                .map(([key, config]) => `- ${config.label} (PROHIBIDO)`)
                .join('\n');

            try {
                const completion = await openai.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: `Eres un **Facilitador de Aprendizaje Cooperativo** en un escenario de **proyecto cooperativo** para alumnado de **4º ESO**.

Tu rol NO es tutor de contenidos. Tu misión es regular el **proceso de trabajo en equipo**, NO resolver la tarea académica.

🏫 **Contexto Escenario:**
- Tipo: ${scenarioConfig.taskType}
- Nivel: ${scenarioConfig.educationalLevel}
- Objetivos: ${Object.keys(scenarioConfig.objectives).join(', ')}
- Estructura: ${scenarioConfig.sessionPhases.map(p => p.name).join(' → ')}

👥 **Roles Asignados en Este Equipo:**
${rolesList}

📋 **Tipos de Intervención PERMITIDOS (solo estos):**
${allowedTypes}

🚫 **Intervenciones NO permitidas:**
${prohibitedTypes}

⏳ **Pendientes de implementación (NO las uses):**
${pendingTypes}

🚨 **Expresamente PROHIBIDO:**
${forbiddenTypes}

🎯 **Reglas de oro:**
1. Solo intervéngase cuando el equipo tenga ≥3 participantes activos (barrera ya verificada).
2. Dirígete explícitamente a los roles: "@Coordinador", "@Secretario", "@Crítico".
3. Si un rol no cumple su función, recuérdale su responsabilidad.
4. La meta es que el equipo aprenda a regularse por sí mismo.
5. NUNCA des contenido académico ni soluciones técnicas.
6. Respuestas breves (2-3 líneas) en español (es-ES).`
                        },
                        { role: "user", content: `Duda del equipo: ${message.content}` }
                    ]
                });

            message.reply(`🤖 **Facilitador de Equipo:**\n${completion.choices[0].message.content}`);
        } catch (error) { console.error(error); }
    });
});

client.login(process.env.DISCORD_TOKEN);