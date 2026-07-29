const { Client, GatewayIntentBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');

const app = express();
const PORT = process.env.PORT || 3000;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

// --- CONFIG EXPRESS ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));
app.use(session({ secret: 'lacentrale_securite_secret_key_2026', resave: false, saveUninitialized: false, cookie: { secure: false } }));

// --- CONFIG DATA ---
const CONFIG_FILE = './config.json';
function getConfig(guildId) {
    if (!fs.existsSync(CONFIG_FILE)) return { support_roles: [], ticket_cat: '', ticket_msg: 'Bonjour ! Un membre du staff va s\'occuper de votre ticket.', banner_url: '' };
    const db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    return db[guildId] || { support_roles: [], ticket_cat: '', ticket_msg: 'Bonjour ! Un membre du staff va s\'occuper de votre ticket.', banner_url: '' };
}
function saveConfig(guildId, newData) {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[guildId] = { ...getConfig(guildId), ...newData };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
}

// --- ROUTES DASHBOARD ---
app.get('/', (req, res) => res.send('<h1>Dashboard en ligne</h1>'));
// (Insère ici tes autres routes app.get ou app.post si tu en as besoin, sinon le bot tournera quand même)

// --- BOT LOGIC ---
client.once('ready', async () => {
    console.log(`✅ Bot et Dashboard connectés : ${client.user.tag}`);
    const commands = [
        { name: 'setup-wizard', description: 'Configure les rôles et la catégorie visuellement' },
        { name: 'setup-panel', description: 'Envoie le menu de ticket public' }
    ];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands('1531412187392901120'), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
    try {
        // --- SETUP WIZARD (Sélection visuelle) ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'setup-wizard') {
            await interaction.deferReply({ ephemeral: true });
            const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Choisis les rôles staff').setMinValues(1).setMaxValues(5));
            const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Choisis la catégorie').setChannelTypes(ChannelType.GuildCategory));
            await interaction.editReply({ content: 'Sélectionne les rôles et la catégorie :', components: [row, row2] });
        }

        // --- SETUP PANEL (Menu public) ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'setup-panel') {
            const couleurDuPanel = '#f97316'; // MODIFIE LA COULEUR ICI
            const embed = new EmbedBuilder()
                .setTitle('🎫 CENTRE DE SUPPORT')
                .setDescription('Bienvenue ! Merci de respecter le personnel. Choisissez un motif ci-dessous pour ouvrir un ticket.')
                .setColor(couleurDuPanel);

            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choisissez un motif').addOptions([
                { label: '🔰 Staff', value: 'staff' }, { label: '🤝 Partenariat', value: 'partenariat' },
                { label: '❓ Question', value: 'question' }, { label: '❗ Signalement', value: 'report' }, { label: '🚨 Urgent', value: 'urgent' }
            ]);
            await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: false });
        }

        // --- ENREGISTREMENT SETUP ---
        if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
            await interaction.deferReply({ ephemeral: true });
            if (interaction.customId === 'setup_roles') saveConfig(interaction.guild.id, { support_roles: interaction.values });
            if (interaction.customId === 'setup_cat') saveConfig(interaction.guild.id, { ticket_cat: interaction.values[0] });
            await interaction.editReply({ content: '✅ Configuration sauvegardée !' });
        }

        // --- OUVERTURE TICKET ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            await interaction.deferReply({ ephemeral: true });
            const cfg = getConfig(interaction.guild.id);
            const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.values[0]}`, parent: cfg.ticket_cat || null });
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `${interaction.user}`, embeds: [new EmbedBuilder().setTitle('🎫 Ticket').setDescription(cfg.ticket_msg)], components: [btn] });
            await interaction.editReply({ content: `✅ Ticket ouvert : ${channel}` });
        }

        // --- FERMETURE TICKET ---
        if (interaction.isButton() && interaction.customId === 'close_btn') {
            await interaction.deferReply();
            const transcript = await discordTranscripts.createTranscript(interaction.channel);
            try { await interaction.user.send({ files: [transcript] }); } catch (e) {}
            await interaction.channel.delete();
        }

    } catch (err) {
        console.error("Erreur détectée :", err);
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));
