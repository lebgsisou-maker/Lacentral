const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');
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
    if (!fs.existsSync(CONFIG_FILE)) return { 
        embed_color: '#f97316', 
        log_channel: null, 
        anti_lien: true, 
        anti_raid: true,
        ticket_desc: "Une question, un souci ou une demande ?\nNotre équipe du Comité d'Ordre Éthique te répond en privé — vite et en toute confidentialité.",
        ticket_roles: [],
        ticket_options: [
            { label: 'Question générale', description: 'Une question sur le serveur', value: 'ticket_general', emoji: '❓' },
            { label: 'Bug / Technique', description: 'Signaler un bug', value: 'ticket_bug', emoji: '🐛' },
            { label: 'Partenariat', description: 'Proposer un partenariat', value: 'ticket_partenariat', emoji: '🤝' },
            { label: 'Autre demande', description: 'Toute autre réclamation', value: 'ticket_autre', emoji: '📋' },
            { label: 'Recrutement Staff', description: 'Rejoindre le staff CDE', value: 'ticket_staff', emoji: '⭐' }
        ]
    };
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[id] || { 
        embed_color: '#f97316', 
        log_channel: null, 
        anti_lien: true, 
        anti_raid: true,
        ticket_desc: "Une question, un souci ou une demande ?\nNotre équipe du Comité d'Ordre Éthique te répond en privé — vite et en toute confidentialité.",
        ticket_roles: [],
        ticket_options: [
            { label: 'Question générale', description: 'Une question sur le serveur', value: 'ticket_general', emoji: '❓' },
            { label: 'Bug / Technique', description: 'Signaler un bug', value: 'ticket_bug', emoji: '🐛' },
            { label: 'Partenariat', description: 'Proposer un partenariat', value: 'ticket_partenariat', emoji: '🤝' },
            { label: 'Autre demande', description: 'Toute autre réclamation', value: 'ticket_autre', emoji: '📋' },
            { label: 'Recrutement Staff', description: 'Rejoindre le staff CDE', value: 'ticket_staff', emoji: '⭐' }
        ]
    };
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

// --- COMMANDES SLASH OFFICIELLES ---
const commands = [
    new SlashCommandBuilder()
        .setName('config')
        .setDescription('Panel de configuration du bot CDE'),
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Bannir et blacklister un utilisateur du serveur')
        .addUserOption(o => o.setName('utilisateur').setDescription('La personne à blacklister').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du blacklist').setRequired(false)),
    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Activer/Désactiver l\'anti-raid intelligent')
        .addBooleanOption(o => o.setName('etat').setDescription('true ou false').setRequired(true)),
    new SlashCommandBuilder()
        .setName('antilien')
        .setDescription('Activer/Désactiver l\'anti-lien & IP Logger')
        .addBooleanOption(o => o.setName('etat').setDescription('true ou false').setRequired(true)),
    new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Envoyer le panneau de tickets Comité d\'Ordre Éthique')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder()
        .setName('set-ticket-desc')
        .setDescription('Modifier la description du panneau de tickets')
        .addStringOption(o => o.setName('description').setDescription('Le nouveau texte de description').setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder()
        .setName('ticket-add-option')
        .setDescription('Ajouter une option personnalisée au menu des tickets')
        .addStringOption(o => o.setName('titre').setDescription('Nom de l\'option (ex: Lumière, Support, etc.)').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Petite description de l\'option').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('Un émoji (ex: 💡)').setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

client.once('ready', async () => {
    console.log(`[BOT CDE] Connecté : ${client.user.tag}`);
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

    // Commandes Slash
    if (i.isChatInputCommand()) {
        if (i.commandName === 'config') {
            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('🛡️ Panel de Configuration — Comité d\'Ordre Éthique (CDE)')
                .setDescription("Gère ici la sécurité, les modules, la couleur et les rôles d'accès aux tickets.")
                .addFields(
                    { name: '🔒 Anti-Lien', value: cfg.anti_lien ? '✅ Activé' : '❌ Désactivé', inline: true },
                    { name: '🚨 Anti-Raid', value: cfg.anti_raid ? '✅ Activé' : '❌ Désactivé', inline: true },
                    { name: '🎟️ Rôles Staff Tickets', value: cfg.ticket_roles && cfg.ticket_roles.length > 0 ? cfg.ticket_roles.map(r => `<@&${r}>`).join(', ') : 'Aucun rôle configuré', inline: false }
                );

            const rowBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_lien').setStyle(cfg.anti_lien ? ButtonStyle.Danger : ButtonStyle.Success).setLabel('Anti-Lien'),
                new ButtonBuilder().setCustomId('toggle_raid').setStyle(cfg.anti_raid ? ButtonStyle.Danger : ButtonStyle.Success).setLabel('Anti-Raid')
            );
            const rowChan = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('log_chan').setChannelTypes(ChannelType.GuildText).setPlaceholder('Sélectionner le salon des logs CDE'));
            const rowRoles = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('ticket_roles_select').setMinValues(1).setMaxValues(5).setPlaceholder('Sélectionner les rôles staff pour les tickets'));

            await i.reply({ embeds: [embed], components: [rowBtn, rowChan, rowRoles], ephemeral: true });
        }

        if (i.commandName === 'blacklist') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
            const user = i.options.getUser('utilisateur');
            const reason = i.options.getString('raison') || 'Aucune raison spécifiée';
            
            addBlacklist(i.guild.id, user.id);
            try {
                await i.guild.members.ban(user.id, { reason });
                await i.reply({ content: `✅ **${user.tag}** a été blacklisté et banni du serveur CDE !`, ephemeral: true });
            } catch (e) {
                await i.reply({ content: `⚠️ Utilisateur ajouté à la blacklist, mais échec du ban (permissions insuffisantes).`, ephemeral: true });
            }
        }

        if (i.commandName === 'antiraid' || i.commandName === 'antilien') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });
            const etat = i.options.getBoolean('etat');
            const key = i.commandName === 'antiraid' ? 'anti_raid' : 'anti_lien';
            saveConfig(i.guild.id, { [key]: etat });
            await i.reply({ content: `✅ ${key} réglé sur **${etat}**`, ephemeral: true });
        }

        if (i.commandName === 'set-ticket-desc') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });
            const newDesc = i.options.getString('description');
            saveConfig(i.guild.id, { ticket_desc: newDesc });
            await i.reply({ content: `✅ La description des tickets a été mise à jour avec succès !\n> ${newDesc}`, ephemeral: true });
        }

        if (i.commandName === 'ticket-add-option') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });
            const title = i.options.getString('titre');
            const desc = i.options.getString('description');
            const emoji = i.options.getString('emoji');
            const valueKey = `ticket_${Date.now()}`;

            let options = cfg.ticket_options || [];
            options.push({ label: title, description: desc, value: valueKey, emoji: emoji });
            saveConfig(i.guild.id, { ticket_options: options });

            await i.reply({ content: `✅ Nouvelle option **"${title}"** ajoutée au menu des tickets avec succès !`, ephemeral: true });
        }

        if (i.commandName === 'ticket-setup') {
            const optionsList = (cfg.ticket_options || []).map(opt => `${opt.emoji} **${opt.label}** · ${opt.description}`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('⚖️ COMITÉ D\'ORDRE ÉTHIQUE — SUPPORT')
                .setDescription(`${cfg.ticket_desc}\n\n📁 **Choisis le motif de ta demande**\n${optionsList}`)
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: '✉️ Réponse en privé • 🔒 Confidentiel • ⚡ Prise en charge rapide • Propulsé par CDE' });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('// Sélectionne une catégorie');

            (cfg.ticket_options || []).forEach(opt => {
                selectMenu.addOptions({ label: opt.label, description: opt.description, value: opt.value, emoji: opt.emoji });
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await i.channel.send({ embeds: [embed], components: [row] });
            await i.reply({ content: '✅ Panneau de tickets CDE déployé avec succès !', ephemeral: true });
        }
    }

    // Boutons du Panel Config
    if (i.isButton() && ['toggle_lien', 'toggle_raid'].includes(i.customId)) {
        if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
        const key = i.customId === 'toggle_lien' ? 'anti_lien' : 'anti_raid';
        const newState = !cfg[key];
        saveConfig(i.guild.id, { [key]: newState });
        await i.update({ content: `✅ ${key} mis à jour : **${newState}** (Refais /config)`, components: [] });
    }

    // Sélection des rôles staff pour les tickets
    if (i.isRoleSelectMenu() && i.customId === 'ticket_roles_select') {
        saveConfig(i.guild.id, { ticket_roles: i.values });
        await i.reply({ content: `✅ Les rôles staff pour les tickets ont été mis à jour avec succès !`, ephemeral: true });
    }

    // Menu Déroulant des Tickets Dynamique
    if (i.isStringSelectMenu() && i.customId === 'ticket_select') {
        const selectedOpt = (cfg.ticket_options || []).find(o => o.value === i.values[0]);
        const ticketType = selectedOpt ? selectedOpt.label : 'Support';

        let overwrites = [
            { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
        ];

        if (cfg.ticket_roles && cfg.ticket_roles.length > 0) {
            cfg.ticket_roles.forEach(roleId => {
                overwrites.push({
                    id: roleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                });
            });
        }

        const channel = await i.guild.channels.create({
            name: `ticket-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: overwrites
        });

        const ticketEmbed = new EmbedBuilder()
            .setColor(cfg.embed_color)
            .setTitle(`⚖️ Ticket CDE : ${ticketType}`)
            .setDescription(`Bienvenue ${i.user},\nUn membre du **Comité d'Ordre Éthique** va bientôt te prendre en charge.\n\nExplique ton problème ou ta demande en détail ci-dessous.`)
            .setThumbnail(i.user.displayAvatarURL());

        const ticketButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setStyle(ButtonStyle.Danger).setLabel('Fermer').setEmoji('🔒'),
            new ButtonBuilder().setCustomId('close_transcript_ticket').setStyle(ButtonStyle.Secondary).setLabel('Fermer + Transcript').setEmoji('📄')
        );

        await channel.send({ content: `<@${i.user.id}> ${cfg.ticket_roles ? cfg.ticket_roles.map(r => `<@&${r}>`).join(' ') : ''}`, embeds: [ticketEmbed], components: [ticketButtons] });
        await i.reply({ content: `✅ Ton ticket a été créé ici : ${channel}`, ephemeral: true });
    }

    // Gestion de la fermeture des tickets & transcripts
    if (i.isButton() && (i.customId === 'close_ticket' || i.customId === 'close_transcript_ticket')) {
        await i.reply({ content: '🔒 Fermeture du ticket en cours...', ephemeral: true });

        if (i.customId === 'close_transcript_ticket') {
            try {
                const messages = await i.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
                
                const buffer = Buffer.from(transcript, 'utf-8');
                await i.user.send({
                    content: `📄 Voici le transcript de ton ticket sur le serveur **${i.guild.name}** (Comité d'Ordre Éthique) :`,
                    files: [{ attachment: buffer, name: `transcript-cde-${i.channel.name}.txt` }]
                }).catch(() => {});
            } catch (e) {
                console.error("Erreur lors de l'envoi du transcript :", e);
            }
        }

        setTimeout(() => {
            i.channel.delete().catch(() => {});
        }, 3000);
    }

    if (i.isChannelSelectMenu() && i.customId === 'log_chan') {
        saveConfig(i.guild.id, { log_channel: i.values[0] });
        await i.reply({ content: `✅ Salon de logs CDE configuré avec succès !`, ephemeral: true });
    }
});

// --- PROTECTION BLACKLIST & ANTI-BOT INTELLIGENT ---
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    const cfg = getConfig(guildId);
    const blacklist = getBlacklist(guildId);

    if (blacklist.includes(member.id)) {
        try {
            await member.ban({ reason: 'Utilisateur présent dans la blacklist du serveur CDE.' });
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
            
            let isSuspicious = false;
            if (botAddLog) {
                const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
                if (accountAgeDays < 2) {
                    isSuspicious = true;
                }
            }

            if (isSuspicious) {
                await member.ban({ reason: 'Bot suspect détecté et bloqué par l\'anti-raid intelligent CDE.' });
                if (botAddLog && botAddLog.executor) {
                    await member.guild.members.ban(botAddLog.executor.id, { reason: `A invité un bot suspect non vérifié (${member.user.tag}).` });
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

    if (cfg.antilien) {
        const content = message.content.toLowerCase();
        const suspiciousPatterns = [
            'grabify.link', 'ipify.org', 'iplogger.', '2st.to', 'yip.su', 'blasze.com',
            'discord-gifts.com', 'discord-nitro.gift', 'steam-community.ru', 'nitro-drop.com', 'webhook.site'
        ];

        if (suspiciousPatterns.some(pattern => content.includes(pattern))) {
            try {
                await message.delete();
                const warning = await message.channel.send(`🚨 **ALERTE SÉCURITÉ CDE** : ${message.author}, ton lien suspect (IP Logger/Malware) a été bloqué !`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);
            } catch (e) {}
        }
    }
});

// --- SERVEUR HTTP RENDER ---
http.createServer((req, res) => {
    res.end('Bot CDE actif');
}).listen(process.env.PORT || 10000, '0.0.0.0');

client.login(process.env.DISCORD_TOKEN)
        
