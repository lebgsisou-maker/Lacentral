const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const http = require('http');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const CONFIG_FILE = './config.json';
const getConfig = (id) => {
    if (!fs.existsSync(CONFIG_FILE)) return { embed_color: '#f97316', support_roles: [], ticket_cat: null, anti_lien: true, anti_raid: false };
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[id] || { embed_color: '#f97316', support_roles: [], ticket_cat: null, anti_lien: true, anti_raid: false };
};

const saveConfig = (id, data) => {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[id] = { ...(db[id] || {}), ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
};

// --- COMMANDES SLASH ---
const commands = [
    new SlashCommandBuilder().setName('config').setDescription('Configurer rôles et catégories'),
    new SlashCommandBuilder().setName('setup-panel').setDescription('Afficher le panel'),
    new SlashCommandBuilder().setName('antiraid').setDescription('Activer/Désactiver Anti-Raid').addBooleanOption(o => o.setName('etat').setRequired(true)),
    new SlashCommandBuilder().setName('antilien').setDescription('Activer/Désactiver Anti-Lien').addBooleanOption(o => o.setName('etat').setRequired(true))
];

client.once('ready', async () => {
    console.log('Bot prêt !');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (i) => {
    const cfg = getConfig(i.guild.id);

    if (i.isChatInputCommand()) {
        if (i.commandName === 'config') {
            const row1 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Sélectionner rôles Staff').setMaxValues(5));
            const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Sélectionner catégorie').setChannelTypes(ChannelType.GuildCategory));
            await i.reply({ content: '⚙️ **Configuration des rôles (jusqu\'à 5) :**', components: [row1, row2], ephemeral: true });
        }
        
        if (i.commandName === 'antiraid' || i.commandName === 'antilien') {
            const etat = i.options.getBoolean('etat');
            const key = i.commandName === 'antiraid' ? 'anti_raid' : 'anti_lien';
            saveConfig(i.guild.id, { [key]: etat });
            await i.reply({ content: `✅ ${key} réglé sur : **${etat}**`, ephemeral: true });
        }

        if (i.commandName === 'setup-panel') {
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').addOptions([{ label: 'Support', value: 'support' }]);
            await i.reply({ components: [new ActionRowBuilder().addComponents(menu)] });
        }
    }

    if (i.isRoleSelectMenu() || i.isChannelSelectMenu()) {
        if (i.customId === 'setup_roles') saveConfig(i.guild.id, { support_roles: i.values });
        if (i.customId === 'setup_cat') saveConfig(i.guild.id, { ticket_cat: i.values[0] });
        await i.reply({ content: '✅ Configuration sauvegardée !', ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === 'ticket_select') {
        const overwrites = [{ id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }];
        cfg.support_roles.forEach(roleId => overwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] }));

        const channel = await i.guild.channels.create({ name: `ticket-${i.user.username}`, parent: cfg.ticket_cat, permissionOverwrites: overwrites });
        
        const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer').setStyle(ButtonStyle.Danger));
        await channel.send({ content: `Bienvenue ${i.user}, un membre du staff va t'aider.`, components: [closeBtn] });
        await i.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'close_ticket') {
        await i.reply({ content: `🔒 Ticket fermé par ${i.user}. Merci à ${cfg.support_roles.map(r => `<@&${r}>`).join(', ')} pour l'aide.` });
        setTimeout(() => i.channel.delete(), 5000);
    }
    
    if (i.isMessageComponent() === false && i.content && cfg.anti_lien) {
        if (i.content.includes('http://') || i.content.includes('https://') || i.content.includes('discord.gg/')) {
            await i.delete();
            i.channel.send(`${i.author}, les liens sont interdits ici !`);
        }
    }
});

// --- SERVEUR HTTP POUR RENDER (Anti-Mise en veille) ---
http.createServer((req, res) => {
    res.end('Bot actif');
}).listen(process.env.PORT || 10000, '0.0.0.0');

// Connexion du bot
client.login(process.env.DISCORD_TOKEN);
