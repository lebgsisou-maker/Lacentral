const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const http = require('http');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

const CONFIG_FILE = './config.json';

const getConfig = (id) => {
    if (!fs.existsSync(CONFIG_FILE)) return { 
        lang: 'fr',
        embed_color: '#5865F2', 
        ticket_banner: 'https://i.imgur.com/3Z612u9.png',
        ticket_desc: "Une question, un souci ou une demande ?\nNotre équipe te répond en privé — vite et en toute confidentialité.",
        ticket_roles: [],
        ticket_options: [
            { label: 'Question générale', description: 'Une question sur le serveur ou autres ?', value: 'ticket_general', emoji: '❓' },
            { label: 'Bug / Problème technique', description: 'Signaler un bug ou un souci', value: 'ticket_bug', emoji: '👾' },
            { label: 'Partenariat & collab', description: 'Proposer un partenariat', value: 'ticket_partenariat', emoji: '🤝' },
            { label: 'Autre', description: 'Toute autre demande', value: 'ticket_autre', emoji: '📋' },
            { label: 'Recrutement Staff', description: 'Salon des recrutements staff', value: 'ticket_staff', emoji: '📄' }
        ]
    };
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[id] || getConfig('default');
};

const saveConfig = (id, data) => {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[id] = { ...(db[id] || {}), ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
};

const commands = [
    new SlashCommandBuilder().setName('config').setDescription('Panel de configuration'),
    new SlashCommandBuilder().setName('help').setDescription('Aide'),
    new SlashCommandBuilder().setName('ticket-setup').setDescription('Déployer le panneau de tickets')
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`[BOT] Connecté : ${client.user.tag}`);
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const cfg = getConfig(i.guild.id);

    if (i.isChatInputCommand()) {
        if (i.commandName === 'ticket-setup') {
            // Ici, la mise en page est optimisée pour ressembler à ton image
            const optionsList = (cfg.ticket_options || []).map(opt => `> **${opt.emoji} ${opt.label}** · ${opt.description}`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setImage(cfg.ticket_banner)
                .setTitle('SUPPORT')
                .setDescription(`### 🎫 Support — Ouvrir un ticket\n${cfg.ticket_desc}\n\n📁 **Choisis le motif de ta demande**\n${optionsList}\n\n📩 **Réponse en privé** • 🔒 **Confidentiel** • ⏱️ **Prise en charge rapide**\n*Propulsé par CDE*`);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('// Sélectionne une catégorie');

            (cfg.ticket_options || []).forEach(opt => {
                selectMenu.addOptions({ label: opt.label, description: opt.description, value: opt.value, emoji: opt.emoji });
            });

            await i.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
            await i.reply({ content: '✅ Panneau déployé.', ephemeral: true });
        }
        
        // ... (le reste des fonctions /config et /help reste identique pour la gestion)
    }
    
    // ... (Logique de création de ticket identique)
});

http.createServer((req, res) => res.end('Bot CDE actif')).listen(process.env.PORT || 10000, '0.0.0.0');
client.login(process.env.DISCORD_TOKEN);
