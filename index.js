const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const http = require('http');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const CONFIG_FILE = './config.json';
const getConfig = (id) => (fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))[id] || { embed_color: '#f97316', support_roles: [], ticket_cat: null } : { embed_color: '#f97316', support_roles: [], ticket_cat: null });
const saveConfig = (id, data) => {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[id] = { ...db[id], ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
};

const commands = [
    new SlashCommandBuilder().setName('config').setDescription('Ouvrir le panneau de configuration'),
    new SlashCommandBuilder().setName('setup-panel').setDescription('Afficher le panel de tickets'),
    new SlashCommandBuilder().setName('giveaway').setDescription('Lancer un giveaway').addStringOption(o => o.setName('prix').setDescription('Cadeau à gagner').setRequired(true))
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Bot en ligne !');
});

client.on('interactionCreate', async (i) => {
    const cfg = getConfig(i.guild.id);

    if (i.isChatInputCommand()) {
        // --- COMMANDE CONFIG ---
        if (i.commandName === 'config') {
            const row1 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Sélectionner rôles Staff'));
            const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Sélectionner catégorie tickets').setChannelTypes(ChannelType.GuildCategory));
            await i.reply({ content: '⚙️ **Configuration :**', components: [row1, row2], ephemeral: true });
        }

        // --- COMMANDE PANEL ---
        if (i.commandName === 'setup-panel') {
            const embed = new EmbedBuilder()
                .setTitle('🎫 LA CENTRALE - SUPPORT')
                .setDescription('Besoin d\'aide ? Ouvre un ticket ci-dessous.')
                .setColor(cfg.embed_color);
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choisir une option')
                .addOptions([
                    { label: '🔰 Staff', value: 'staff' },
                    { label: '🤝 Partenariat', value: 'partenariat' }
                ]);
            await i.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        }

        // --- COMMANDE GIVEAWAY ---
        if (i.commandName === 'giveaway') {
            const prize = i.options.getString('prix');
            const embed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY !')
                .setDescription(`Cadeau : **${prize}**\nClique sur le bouton pour participer !`)
                .setColor('#f97316');
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_giveaway').setLabel('Participer').setStyle(ButtonStyle.Primary));
            await i.reply({ embeds: [embed], components: [btn] });
        }
    }

    // --- GESTION MENUS ET BOUTONS ---
    if (i.isRoleSelectMenu() || i.isChannelSelectMenu()) {
        if (i.customId === 'setup_roles') saveConfig(i.guild.id, { support_roles: i.values });
        if (i.customId === 'setup_cat') saveConfig(i.guild.id, { ticket_cat: i.values[0] });
        await i.reply({ content: '✅ Configuration sauvegardée !', ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === 'ticket_select') {
        const channel = await i.guild.channels.create({
            name: `ticket-${i.values[0]}`,
            parent: cfg.ticket_cat,
            permissionOverwrites: [{ id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }]
        });
        await i.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'join_giveaway') {
        await i.reply({ content: '✅ Tu participes au tirage au sort !', ephemeral: true });
    }
});

http.createServer((req, res) => res.end('Bot actif')).listen(process.env.PORT || 10000);
client.login(process.env.DISCORD_TOKEN);
