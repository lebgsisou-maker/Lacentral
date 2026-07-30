const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const http = require('http'); // Ajout pour Render

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const CONFIG_FILE = './config.json';
const getConfig = (id) => (fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))[id] || { embed_color: '#f97316', support_roles: [], ticket_cat: null } : { embed_color: '#f97316', support_roles: [], ticket_cat: null });
const saveConfig = (id, data) => {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[id] = { ...db[id], ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
};

const commands = [
    new SlashCommandBuilder().setName('setup-wizard').setDescription('Configure rôles, catégorie et couleur'),
    new SlashCommandBuilder().setName('setup-panel').setDescription('Affiche le panel de ticket'),
    new SlashCommandBuilder().setName('ban').setDescription('Bannir').addUserOption(o => o.setName('target').setDescription('Membre').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Expulser').addUserOption(o => o.setName('target').setDescription('Membre').setRequired(true)),
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout').addUserOption(o => o.setName('target').setDescription('Membre').setRequired(true)).addIntegerOption(o => o.setName('time').setDescription('Minutes').setRequired(true))
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Bot en ligne et prêt !');
});

client.on('interactionCreate', async (i) => {
    try {
        const cfg = getConfig(i.guild.id);

        if (i.isChatInputCommand()) {
            if (i.commandName === 'setup-wizard') {
                const row1 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Choisis les rôles Staff').setMinValues(1).setMaxValues(10));
                const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Choisis la catégorie').setChannelTypes(ChannelType.GuildCategory));
                await i.reply({ content: 'Sélectionne les rôles Staff et la catégorie des tickets :', components: [row1, row2], ephemeral: true });
            }

            if (i.commandName === 'setup-panel') {
                const embed = new EmbedBuilder()
                    .setTitle('🎫 LA CENTRALE - SUPPORT')
                    .setDescription('Bienvenue sur le support officiel. Notre équipe est disponible pour vous aider rapidement.\n\nChoisissez une option dans le menu ci-dessous pour ouvrir un ticket personnalisé selon votre besoin. Merci de rester courtois et de fournir toutes les informations nécessaires à votre requête.')
                    .setColor(cfg.embed_color);
                const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choisir une option')
                    .addOptions([
                        { label: '🔰 Staff', value: 'staff' },
                        { label: '🤝 Partenariat', value: 'partenariat' },
                        { label: '❓ Question', value: 'question' },
                        { label: '❗ Signalement', value: 'report' },
                        { label: '🚨 Urgent', value: 'urgent' }
                    ]);
                await i.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
            }

            if (i.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                if (i.commandName === 'ban') { await i.guild.members.ban(i.options.getUser('target')); await i.reply('🔨 Banni.'); }
                if (i.commandName === 'kick') { await i.options.getMember('target').kick(); await i.reply('👢 Expulsé.'); }
                if (i.commandName === 'timeout') { await i.options.getMember('target').timeout(i.options.getInteger('time') * 60 * 1000); await i.reply('⏳ Timeout appliqué.'); }
            }
        }

        if (i.isRoleSelectMenu() || i.isChannelSelectMenu()) {
            if (i.customId === 'setup_roles') saveConfig(i.guild.id, { support_roles: i.values });
            if (i.customId === 'setup_cat') saveConfig(i.guild.id, { ticket_cat: i.values[0] });
            const modal = new ModalBuilder().setCustomId('color_modal').setTitle('Configuration Couleur')
                .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Code couleur (ex: #f97316)').setStyle(TextInputStyle.Short)));
            await i.showModal(modal);
        }

        if (i.isModalSubmit() && i.customId === 'color_modal') {
            saveConfig(i.guild.id, { embed_color: i.fields.getTextInputValue('color') });
            await i.reply({ content: '✅ Configuration sauvegardée !', ephemeral: true });
        }

        if (i.isStringSelectMenu() && i.customId === 'ticket_select') {
            const channel = await i.guild.channels.create({
                name: `ticket-${i.values[0]}`,
                parent: cfg.ticket_cat,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
                    ...cfg.support_roles.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] }))
                ]
            });
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `Ticket ${i.values[0]} ouvert par ${i.user}`, components: [btn] });
            await i.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
        }

        if (i.isButton() && i.customId === 'close_btn') await i.channel.delete();

    } catch (e) { console.error(e); }
});

// Serveur HTTP pour Render
http.createServer((req, res) => res.end('Bot actif')).listen(process.env.PORT || 10000);

client.login(process.env.DISCORD_TOKEN);
