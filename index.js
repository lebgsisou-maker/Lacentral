const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const http = require('http');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.AutoModerationExecution
    ] 
});

const CONFIG_FILE = './config.json';
const BLACKLIST_FILE = './blacklist.json';

// --- GESTION CONFIG & BLACKLIST ---
const getConfig = (id) => {
    if (!fs.existsSync(CONFIG_FILE)) return { embed_color: '#f97316', log_channel: null, anti_lien: true, anti_raid: true };
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[id] || { embed_color: '#f97316', log_channel: null, anti_lien: true, anti_raid: true };
};

const saveConfig = (id, data) => {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[id] = { ...(db[id] || {}), ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
};

const getBlacklist = (guildId) => {
    if (!fs.existsSync(BLACKLIST_FILE)) return [];
    const db = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
    return db[guildId] || [];
};

const addBlacklist = (guildId, userId) => {
    let db = fs.existsSync(BLACKLIST_FILE) ? JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8')) : {};
    if (!db[guildId]) db[guildId] = [];
    if (!db[guildId].includes(userId)) {
        db[guildId].push(userId);
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(db, null, 2));
    }
};

const joinTracker = new Map();

// --- COMMANDES SLASH OFFICIELLES ---
const commands = [
    new SlashCommandBuilder()
        .setName('config')
        .setDescription('Panel de configuration du bot'),
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Bannir et blacklister un utilisateur du serveur')
        .addUserOption(o => o.setName('utilisateur').setDescription('La personne à blacklister').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du blacklist').setRequired(false)),
    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Activer/Désactiver l\'anti-raid')
        .addBooleanOption(o => o.setName('etat').setDescription('true ou false').setRequired(true)),
    new SlashCommandBuilder()
        .setName('antilien')
        .setDescription('Activer/Désactiver l\'anti-lien')
        .addBooleanOption(o => o.setName('etat').setDescription('true ou false').setRequired(true))
];

client.once('ready', async () => {
    console.log(`[BOT] Connecté : ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('[COMMANDES] Actualisation des commandes Slash...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('[COMMANDES] Enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }
});

// --- GESTIONNAIRE D'INTERACTIONS ---
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const cfg = getConfig(i.guild.id);

    if (i.isChatInputCommand()) {
        if (i.commandName === 'config') {
            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('🛡️ Panel de Sécurité Avancé')
                .addFields(
                    { name: '🔒 Anti-Lien / IP Logger', value: cfg.anti_lien ? '✅ Activé' : '❌ Désactivé', inline: true },
                    { name: '🚨 Anti-Raid & Anti-Bot', value: cfg.anti_raid ? '✅ Activé' : '❌ Désactivé', inline: true }
                );
            const rowBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_lien').setStyle(cfg.anti_lien ? ButtonStyle.Danger : ButtonStyle.Success).setLabel('Anti-Lien'),
                new ButtonBuilder().setCustomId('toggle_raid').setStyle(cfg.anti_raid ? ButtonStyle.Danger : ButtonStyle.Success).setLabel('Anti-Raid')
            );
            const rowChan = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('log_chan').setChannelTypes(ChannelType.GuildText).setPlaceholder('Salon des logs'));
            await i.reply({ embeds: [embed], components: [rowBtn, rowChan], ephemeral: true });
        }

        if (i.commandName === 'blacklist') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
            const user = i.options.getUser('utilisateur');
            const reason = i.options.getString('raison') || 'Aucune raison spécifiée';
            
            addBlacklist(i.guild.id, user.id);
            try {
                await i.guild.members.ban(user.id, { reason });
                await i.reply({ content: `✅ **${user.tag}** a été blacklisté et banni avec succès !`, ephemeral: true });
            } catch (e) {
                await i.reply({ content: `⚠️ Utilisateur blacklisté dans la base, mais impossible de le bannir (permissions insuffisantes).`, ephemeral: true });
            }
        }

        if (i.commandName === 'antiraid' || i.commandName === 'antilien') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });
            const etat = i.options.getBoolean('etat');
            const key = i.commandName === 'antiraid' ? 'anti_raid' : 'anti_lien';
            saveConfig(i.guild.id, { [key]: etat });
            await i.reply({ content: `✅ ${key} réglé sur **${etat}**`, ephemeral: true });
        }
    }

    if (i.isButton()) {
        if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
        const key = i.customId === 'toggle_lien' ? 'anti_lien' : 'anti_raid';
        const newState = !cfg[key];
        saveConfig(i.guild.id, { [key]: newState });
        await i.update({ content: `✅ ${key} mis à jour : **${newState}** (Refais /config)`, components: [] });
    }

    if (i.isChannelSelectMenu() && i.customId === 'log_chan') {
        saveConfig(i.guild.id, { log_channel: i.values[0] });
        await i.reply({ content: `✅ Salon de logs configuré !`, ephemeral: true });
    }
});

// --- PROTECTION BLACKLIST & ANTI-BOT ---
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    const cfg = getConfig(guildId);
    const blacklist = getBlacklist(guildId);

    if (blacklist.includes(member.id)) {
        try {
            await member.ban({ reason: 'Utilisateur présent dans la blacklist du serveur.' });
            return;
        } catch (e) {}
    }

    if (member.user.bot && cfg.anti_raid) {
        try {
            const fetchedLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: 28, // BOT_ADD
            });
            const botAddLog = fetchedLogs.entries.first();
            
            await member.ban({ reason: 'Bot non autorisé détecté.' });

            if (botAddLog) {
                const { executor } = botAddLog;
                if (executor.id !== member.guild.ownerId) {
                    await member.guild.members.ban(executor.id, { reason: `A invité un bot suspect (${member.user.tag}).` });
                    
                    if (cfg.log_channel) {
                        const logChan = member.guild.channels.cache.get(cfg.log_channel);
                        if (logChan) {
                            logChan.send(`🚨 **CONTRE-ATTAQUE SÉCURITÉ** !\nLe bot **${member.user.tag}** et l'utilisateur **${executor.tag}** qui l'a invité ont été **bannis instantanément** !`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Erreur anti-bot :", e);
        }
    }
});

// --- ANALYSE ANTI-LIEN & IP LOGGER ---
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    const cfg = getConfig(message.guild.id);

    if (cfg.anti_lien) {
        const content = message.content.toLowerCase();
        const suspiciousPatterns = [
            'grabify.link', 'ipify.org', 'iplogger.', '2st.to', 'yip.su', 'blasze.com',
            'discord-gifts.com', 'discord-nitro.gift', 'steam-community.ru', 'nitro-drop.com', 'webhook.site'
        ];

        if (suspiciousPatterns.some(pattern => content.includes(pattern))) {
            try {
                await message.delete();
                const warning = await message.channel.send(`🚨 **ALERTE SÉCURITÉ** : ${message.author}, ton lien suspect (IP Logger/Malware) a été bloqué !`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);
            } catch (e) {}
        }
    }
});

// --- SERVEUR HTTP RENDER ---
http.createServer((req, res) => {
    res.end('Bot actif');
}).listen(process.env.PORT || 10000, '0.0.0.0');

client.login(process.env.DISCORD_TOKEN);
    
