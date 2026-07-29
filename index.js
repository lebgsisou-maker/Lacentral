const { Client, GatewayIntentBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const app = express();
const PORT = process.env.PORT || 3000;

// --- THÈME BLANC & ORANGE ---
const THEME = `
    <style>
        body { font-family: sans-serif; background: #ffffff; color: #333; margin: 0; }
        .nav { background: #fff; padding: 20px; border-bottom: 3px solid #f97316; display: flex; justify-content: space-between; align-items: center; }
        .btn-orange { background: #f97316; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; }
        .card { background: #fff; border: 2px solid #f97316; border-radius: 15px; padding: 25px; margin: 20px auto; max-width: 600px; }
    </style>
`;

// --- CONFIGURATION ---
const CONFIG_FILE = './config.json';
const getConfig = (id) => (fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))[id] || { embed_color: '#f97316' } : { embed_color: '#f97316' });
const saveConfig = (id, data) => {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[id] = { ...db[id], ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
};

// --- DASHBOARD ROUTES ---
app.get('/', (req, res) => res.send(`${THEME}<body><div class="nav"><h1>LA CENTRALE</h1></div><div class="card"><h2>Dashboard Pro</h2><p>Gérez vos tickets en toute simplicité.</p></div></body>`));

// --- BOT LOGIC ---
client.on('interactionCreate', async (i) => {
    try {
        // 1. SETUP WIZARD (Wizard + Couleur)
        if (i.isChatInputCommand() && i.commandName === 'setup-wizard') {
            await i.deferReply({ ephemeral: true });
            const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Choisis les rôles').setMinValues(1).setMaxValues(5));
            const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Catégorie').setChannelTypes(ChannelType.GuildCategory));
            await i.editReply({ components: [row, row2] });
        }

        if (i.isRoleSelectMenu() || i.isChannelSelectMenu()) {
            if (i.customId === 'setup_roles') saveConfig(i.guild.id, { support_roles: i.values });
            if (i.customId === 'setup_cat') saveConfig(i.guild.id, { ticket_cat: i.values[0] });
            const modal = new ModalBuilder().setCustomId('color_modal').setTitle('Configuration Couleur');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Code couleur (ex: #f97316)').setStyle(TextInputStyle.Short)));
            await i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === 'color_modal') {
            saveConfig(i.guild.id, { embed_color: i.fields.getTextInputValue('color') });
            await i.reply({ content: '✅ Sauvegardé !', ephemeral: true });
        }

        // 2. SETUP PANEL (Public)
        if (i.isChatInputCommand() && i.commandName === 'setup-panel') {
            await i.deferReply({ ephemeral: false });
            const cfg = getConfig(i.guild.id);
            const embed = new EmbedBuilder()
                .setTitle('🎫 LA CENTRALE - SUPPORT')
                .setDescription('Bienvenue. Merci de respecter le personnel. Choisissez un motif ci-dessous.')
                .setColor(cfg.embed_color || '#f97316');
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').addOptions([
                { label: '🔰 Staff', value: 'staff' }, { label: '🤝 Partenariat', value: 'partenariat' },
                { label: '❓ Question', value: 'question' }, { label: '❗ Signalement', value: 'report' }, { label: '🚨 Urgent', value: 'urgent' }
            ]);
            await i.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        }

        // 3. TICKET OPEN/CLOSE
        if (i.isStringSelectMenu() && i.customId === 'ticket_select') {
            await i.deferReply({ ephemeral: true });
            const channel = await i.guild.channels.create({ name: `ticket-${i.values[0]}`, parent: getConfig(i.guild.id).ticket_cat });
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `${i.user}`, components: [btn] });
            await i.editReply({ content: `✅ Ticket : ${channel}` });
        }

        if (i.isButton() && i.customId === 'close_btn') {
            await i.deferReply();
            const transcript = await discordTranscripts.createTranscript(i.channel);
            try { await i.user.send({ files: [transcript] }); } catch (e) {}
            await i.channel.delete();
        }

    } catch (e) { console.error(e); }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, () => console.log(`Bot et Dashboard prêts sur port ${PORT}`));
