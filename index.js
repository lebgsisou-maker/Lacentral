const { Client, GatewayIntentBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ComponentType } = require('discord.js');
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'secret_key_2026', resave: false, saveUninitialized: false }));

const CONFIG_FILE = './config.json';
function getConfig(guildId) {
    if (!fs.existsSync(CONFIG_FILE)) return { support_roles: [], ticket_cat: '', ticket_msg: 'Un membre du staff va arriver.', banner_url: '' };
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[guildId] || { support_roles: [], ticket_cat: '', ticket_msg: 'Un membre du staff va arriver.', banner_url: '' };
}
function saveConfig(guildId, newData) {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[guildId] = { ...getConfig(guildId), ...newData };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
}

// --- DASHBOARD (Tes routes) ---
app.get('/', (req, res) => res.send('<h1>Dashboard en ligne</h1>'));

// --- BOT DISCORD ---
client.once('ready', async () => {
    console.log(`✅ Bot en ligne : ${client.user.tag}`);
    const commands = [
        { name: 'setup-wizard', description: 'Configure rôles et catégorie' },
        { name: 'setup-panel', description: 'Envoie le menu de ticket' }
    ];
    await new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands('1531412187392901120'), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
    try {
        // --- 1. SETUP WIZARD ---
        if (interaction.isChatInputCommand()) {
            await interaction.deferReply({ ephemeral: true });
            if (interaction.commandName === 'setup-wizard') {
                const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Choisis les rôles staff').setMinValues(1).setMaxValues(5));
                const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Choisis la catégorie').setChannelTypes(ChannelType.GuildCategory));
                await interaction.editReply({ content: 'Sélectionne les paramètres :', components: [row, row2] });
            }
            if (interaction.commandName === 'setup-panel') {
                const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choisis un motif').addOptions([
                    { label: '🔰 Staff', value: 'staff' }, { label: '🤝 Partenariat', value: 'partenariat' },
                    { label: '❓ Question', value: 'question' }, { label: '❗ Signalement', value: 'report' }, { label: '🚨 Urgent', value: 'urgent' }
                ]);
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🎫 SUPPORT').setColor('#f97316')], components: [new ActionRowBuilder().addComponents(menu)] });
            }
        }

        // --- 2. ENREGISTREMENT ---
        if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
            await interaction.deferReply({ ephemeral: true });
            if (interaction.customId === 'setup_roles') saveConfig(interaction.guild.id, { support_roles: interaction.values });
            if (interaction.customId === 'setup_cat') saveConfig(interaction.guild.id, { ticket_cat: interaction.values[0] });
            await interaction.editReply({ content: '✅ Sauvegardé !' });
        }

        // --- 3. OUVERTURE TICKET (SANS FORMULAIRE) ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            await interaction.deferReply({ ephemeral: true });
            const cfg = getConfig(interaction.guild.id);
            const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.values[0]}`, parent: cfg.ticket_cat || null });
            
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `${interaction.user}`, embeds: [new EmbedBuilder().setTitle('🎫 Ticket').setDescription(cfg.ticket_msg).setImage(cfg.banner_url || null)], components: [btn] });
            await interaction.editReply({ content: `✅ Ticket ouvert : ${channel}` });
        }

        // --- 4. FERMETURE & TRANSCRIPT ---
        if (interaction.isButton() && interaction.customId === 'close_btn') {
            await interaction.deferReply();
            const transcript = await discordTranscripts.createTranscript(interaction.channel);
            try { await interaction.user.send({ files: [transcript] }); } catch (e) {}
            await interaction.channel.delete();
        }

    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));

