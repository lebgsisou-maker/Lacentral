const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

// --- CONFIGURATION ---
const CONFIG_FILE = './config.json';
const getConfig = (id) => (fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))[id] || { embed_color: '#f97316' } : { embed_color: '#f97316' });
const saveConfig = (id, data) => {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[id] = { ...db[id], ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
};

// --- COMMANDES ---
const commands = [
    new SlashCommandBuilder().setName('setup-wizard').setDescription('Configure ton panel et couleur'),
    new SlashCommandBuilder().setName('setup-panel').setDescription('Affiche le panel de ticket'),
    new SlashCommandBuilder().setName('ban').setDescription('Bannir').addUserOption(o => o.setName('target').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Expulser').addUserOption(o => o.setName('target').setRequired(true)),
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout').addUserOption(o => o.setName('target').setRequired(true)).addIntegerOption(o => o.setName('time').setRequired(true))
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Bot prêt et commandes enregistrées.');
});

client.on('interactionCreate', async (i) => {
    try {
        const cfg = getConfig(i.guild.id);

        // --- WIZARD ---
        if (i.isChatInputCommand() && i.commandName === 'setup-wizard') {
            const modal = new ModalBuilder().setCustomId('wizard_modal').setTitle('Configuration du Panel');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Couleur Hexa (ex: #f97316)').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Titre du panel').setStyle(TextInputStyle.Short))
            );
            await i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === 'wizard_modal') {
            saveConfig(i.guild.id, { embed_color: i.fields.getTextInputValue('color'), title: i.fields.getTextInputValue('title') });
            await i.reply({ content: '✅ Configuration sauvegardée !', ephemeral: true });
        }

        // --- PANEL & OPTIONS ---
        if (i.isChatInputCommand() && i.commandName === 'setup-panel') {
            const embed = new EmbedBuilder().setTitle(cfg.title || 'Support').setColor(cfg.embed_color);
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Sélectionne ton motif')
                .addOptions([
                    { label: '🔰 Staff', value: 'staff' }, { label: '🤝 Partenariat', value: 'partenariat' },
                    { label: '❓ Question', value: 'question' }, { label: '🚨 Urgent', value: 'urgent' }
                ]);
            await i.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        }

        // --- TICKETS (SANS V BLEU) ---
        if (i.isStringSelectMenu() && i.customId === 'ticket_select') {
            const channel = await i.guild.channels.create({ name: `ticket-${i.values[0]}` });
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `Ticket ${i.values[0]} ouvert par ${i.user}`, components: [btn] });
            // On utilise update au lieu de reply pour ne pas avoir le blocage
            await i.reply({ content: `✅ Ton ticket est ici : ${channel}`, ephemeral: true });
        }

        if (i.isButton() && i.customId === 'close_btn') await i.channel.delete();
        
        // MODERATION (ban, kick, timeout) ... (même code que précédemment)

    } catch (e) { console.error(e); }
});

client.login(process.env.DISCORD_TOKEN);
