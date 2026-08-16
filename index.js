const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');
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
const BLACKLIST_FILE = './blacklist.json';
const PARTNER_BLACKLIST_FILE = './partner_blacklist.json';

// TON ID PERSONNEL (SUPER-ADMIN / OWNER EXCLUSIF)
const OWNER_ID = "1524485143237103829"; 

// --- GESTION DES FICHIERS DE DONNÉES ---
const getConfig = (id) => {
    if (!fs.existsSync(CONFIG_FILE)) return { 
        embed_color: '#5865F2', 
        ticket_desc: "Une question, un souci ou une demande ?\nNotre équipe te répond en privé — vite et en toute confidentialité.",
        ticket_roles: [],
        antiraid_active: false,
        ticket_options: [
            { label: "Contacter L'équipe Du Staff", description: 'Besoin de joindre le staff ?', value: 'ticket_staff_contact', emoji: '🔰' },
            { label: 'Partenariat & Collab', description: 'Proposer un partenariat', value: 'ticket_partenariat', emoji: '🤝' },
            { label: 'Problème Technique', description: 'Signaler un bug technique', value: 'ticket_technique', emoji: '🛠️' },
            { label: 'Signalement', description: 'Signaler un membre ou un problème', value: 'ticket_signalement', emoji: '🚨' },
            { label: 'Autre-Demande', description: 'Toute autre réclamation', value: 'ticket_autre', emoji: '❓' }
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

const getGlobalData = (file) => {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const saveGlobalData = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// --- ENREGISTREMENT DES COMMANDES SLASH ---
const commands = [
    new SlashCommandBuilder().setName('config').setDescription('Ouvrir le panel de configuration'),
    new SlashCommandBuilder().setName('help').setDescription('Afficher l aide du bot'),
    new SlashCommandBuilder().setName('ticket-setup').setDescription('Déployer le panneau de tickets').setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    // Blacklist Utilisateur
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Gérer la blacklist des utilisateurs')
        .addSubcommand(sub => sub.setName('add').setDescription('Ajouter un utilisateur à la blacklist').addUserOption(opt => opt.setName('user').setDescription('Utilisateur à bannir').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Raison').setRequired(false)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Retirer un utilisateur de la blacklist').addUserOption(opt => opt.setName('user').setDescription('Utilisateur à débannir').setRequired(true))),

    // Blacklist & Sanctions Partenaires (Réservé au Propriétaire)
    new SlashCommandBuilder()
        .setName('partner-blacklist')
        .setDescription('Gestion exclusive des partenariats (Réservé au créateur)')
        .addSubcommand(sub => sub.setName('sanction').setDescription('Ajouter un strike ou sanctionner un serveur partenaire').addStringOption(opt => opt.setName('guild_id').setDescription('ID du serveur partenaire').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Raison de la sanction').setRequired(true)))
        .addSubcommand(sub => sub.setName('view').setDescription('Voir la liste des serveurs partenaires sanctionnés/blacklistés')),

    // Anti-Raid & Sécurité Max
    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Activer ou désactiver le mode alerte anti-raid')
        .addStringOption(opt => opt.setName('action').setDescription('Activer ou désactiver').setRequired(true).addChoices({ name: 'Activer (Sécurité Max)', value: 'on' }, { name: 'Désactiver', value: 'off' }))
];

client.once('ready', async () => {
    console.log(`[BOT CDE] Connecté : ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[COMMANDES] Enregistrées et synchronisées !');
    } catch (error) {
        console.error(error);
    }
});

// --- SÉCURITÉ : VÉRIFICATION DES ENTRÉES (Anti-Raid & Blacklist Membres) ---
client.on('guildMemberAdd', async (member) => {
    const blacklist = getGlobalData(BLACKLIST_FILE);
    if (blacklist[member.id]) {
        try {
            await member.ban({ reason: `[CDE Blacklist Globale] Utilisateur interdit de séjour.` });
            return;
        } catch (e) {}
    }

    const cfg = getConfig(member.guild.id);
    if (cfg.antiraid_active) {
        // Mode Sécurité Max : Si le compte a moins de 7 jours, on bloque/bannit direct pour éviter les raids de bots
        const accountAge = Date.now() - member.user.createdTimestamp;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (accountAge < sevenDays) {
            try {
                await member.ban({ reason: `[CDE Anti-Raid Sécurité Max] Compte trop récent détecté.` });
            } catch (e) {}
        }
    }
});

// --- SÉCURITÉ : ANTI-LIENS SUSPECTS (IP Loggers & Serveurs de Raids) ---
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content.toLowerCase();
    
    // Détection basique d'IP Loggers connus ou liens suspects piégés
    const suspiciousKeywords = ['grabify.link', 'iplogger.', 'discord-gift.', 'steam-nitro.', 'free-nitro.'];
    const isSuspicious = suspiciousKeywords.some(keyword => content.includes(keyword));

    if (isSuspicious) {
        try {
            await message.delete();
            await message.channel.send(`⚠️ ${message.author}, ton message a été supprimé car il contient un lien potentiellement dangereux (IP Logger / Phishing).`);
        } catch (e) {}
        return;
    }
});

// --- GESTION DES INTERACTIONS (Commandes & Boutons) ---
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const cfg = getConfig(i.guild.id);

    if (i.isChatInputCommand()) {
        
        // 1. COMMANDE HELP
        if (i.commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('📜 Aide — Bot CDE / EMT')
                .setDescription('`/config` : Ouvre le panel de configuration\n`/ticket-setup` : Envoie le panneau de tickets\n`/blacklist` : Gérer la blacklist des utilisateurs\n`/antiraid` : Activer/Désactiver l alerte de sécurité max\n`/partner-blacklist` : Réservé au créateur (CDE)');
            await i.reply({ embeds: [helpEmbed], ephemeral: true });
        }

        // 2. COMMANDE CONFIG
        if (i.commandName === 'config') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('🛡️ Panel de Configuration CDE')
                .setDescription("Gère les rôles staff et la configuration de sécurité.");

            const rowRoles = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('ticket_roles_select').setMinValues(1).setMaxValues(5).setPlaceholder('Sélectionner les rôles staff tickets')
            );

            await i.reply({ embeds: [embed], components: [rowRoles], ephemeral: true });
        }

        // 3. COMMANDE TICKET-SETUP (Sans bannière Imgur)
        if (i.commandName === 'ticket-setup') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

            const optionsList = (cfg.ticket_options || []).map(opt => `${opt.emoji} **${opt.label}** · ${opt.description}`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('<:cdesupport:1538273039609765918> SUPPORT')
                .setDescription(`<:cdesupport:1538273039609765918> **Support — Ouvrir un ticket**\n${cfg.ticket_desc}\n\n<:cdedossier:1538273514295918612> **Choisis le motif de ta demande**\n${optionsList}\n\n<:cdemail:1538272955350519920> Réponse en privé • <:cdeconfidialit:1538272990461042891> Confidentialité • <:cdehorloge:1538273017782861834> Prise en charge rapide\nPropulsé par CDE`);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('// Sélectionne une catégorie');

            (cfg.ticket_options || []).forEach(opt => {
                selectMenu.addOptions({ label: opt.label, description: opt.description, value: opt.value, emoji: opt.emoji });
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await i.channel.send({ embeds: [embed], components: [row] });
            await i.reply({ content: '✅ Panneau de tickets déployé avec succès !', ephemeral: true });
        }

        // 4. COMMANDE BLACKLIST UTILISATEUR
        if (i.commandName === 'blacklist') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return i.reply({ content: '❌ Réservé aux membres autorisés à bannir.', ephemeral: true });

            const sub = i.options.getSubcommand();
            const targetUser = i.options.getUser('user');
            let blacklist = getGlobalData(BLACKLIST_FILE);

            if (sub === 'add') {
                const reason = i.options.getString('reason') || 'Aucune raison spécifiée';
                blacklist[targetUser.id] = { tag: targetUser.tag, reason: reason, date: Date.now() };
                saveGlobalData(BLACKLIST_FILE, blacklist);
                
                try { await i.guild.members.ban(targetUser.id, { reason: reason }); } catch (e) {}
                await i.reply({ content: `✅ **${targetUser.tag}** a été ajouté à la blacklist globale et banni.`, ephemeral: true });
            } 
            else if (sub === 'remove') {
                if (!blacklist[targetUser.id]) return i.reply({ content: '❌ Cet utilisateur n est pas dans la blacklist.', ephemeral: true });
                delete blacklist[targetUser.id];
                saveGlobalData(BLACKLIST_FILE, blacklist);
                await i.reply({ content: `✅ **${targetUser.tag}** a été retiré de la blacklist.`, ephemeral: true });
            }
        }

        // 5. COMMANDE ANTI-RAID (SÉCURITÉ MAX)
        if (i.commandName === 'antiraid') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });

            const action = i.options.getString('action');
            const isActive = action === 'on';
            saveConfig(i.guild.id, { antiraid_active: isActive });

            const alertEmbed = new EmbedBuilder()
                .setColor(isActive ? '#FF0000' : '#00FF00')
                .setTitle(isActive ? '🚨 ALERTE : MODE SÉCURITÉ MAX ACTIVÉ' : '🛡️ SÉCURITÉ : Mode normal rétabli')
                .setDescription(isActive ? 'Le système anti-raid strict est enclenché. Les comptes suspects ou récents seront bloqués automatiquement.' : 'Le serveur a retrouvé un fonctionnement normal.');

            await i.reply({ embeds: [alertEmbed] });
        }

        // 6. COMMANDE PARTNER-BLACKLIST (EXCLUSIVITÉ PROPRIÉTAIRE - TOI SEUL)
        if (i.commandName === 'partner-blacklist') {
            if (i.user.id !== OWNER_ID) {
                return i.reply({ content: '❌ Accès refusé. Cette commande est strictement réservée au fondateur du CDE.', ephemeral: true });
            }

            const sub = i.options.getSubcommand();
            let partnerDb = getGlobalData(PARTNER_BLACKLIST_FILE);

            if (sub === 'sanction') {
                const guildId = i.options.getString('guild_id');
                const reason = i.options.getString('reason');

                if (!partnerDb[guildId]) {
                    partnerDb[guildId] = { strikes: 0, history: [] };
                }

                partnerDb[guildId].strikes += 1;
                partnerDb[guildId].history.push({ reason, date: Date.now() });

                let responseMsg = `⚠️ Le serveur **${guildId}** a reçu un avertissement. (Strike ${partnerDb[guildId].strikes}/3)`;

                if (partnerDb[guildId].strikes >= 3) {
                    responseMsg += `\n🚨 **Seuil critique atteint (3 strikes) ! Le serveur est définitivement blacklisté du réseau CDE.**`;
                }

                saveGlobalData(PARTNER_BLACKLIST_FILE, partnerDb);
                await i.reply({ content: responseMsg, ephemeral: true });
            } 
            else if (sub === 'view') {
                if (Object.keys(partnerDb).length === 0) {
                    return i.reply({ content: '📋 Aucun serveur partenaire sanctionné pour le moment.', ephemeral: true });
                }

                let listText = Object.entries(partnerDb).map(([gId, data]) => `• **Serveur ID:** ${gId} | **Strikes:** ${data.strikes}/3`).join('\n');
                const viewEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🔒 Liste Secrète des Partenaires Sanctionnés')
                    .setDescription(listText);

                await i.reply({ embeds: [viewEmbed], ephemeral: true });
            }
        }
    }

    // --- GESTION DES MENUS ET BOUTONS DE TICKETS ---
    if (i.isRoleSelectMenu() && i.customId === 'ticket_roles_select') {
        saveConfig(i.guild.id, { ticket_roles: i.values });
        await i.reply({ content: `✅ Rôles staff mis à jour !`, ephemeral: true });
    }

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
                overwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
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
            .setDescription(`Bienvenue ${i.user},\nUn membre du staff va te prendre en charge.\n\nExplique ton problème ci-dessous.`)
            .setThumbnail(i.user.displayAvatarURL());

        const ticketButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setStyle(ButtonStyle.Danger).setLabel('Fermer').setEmoji('🔒'),
            new ButtonBuilder().setCustomId('close_transcript_ticket').setStyle(ButtonStyle.Secondary).setLabel('Fermer + Transcript').setEmoji('📄')
        );

        await channel.send({ content: `<@${i.user.id}> ${cfg.ticket_roles ? cfg.ticket_roles.map(r => `<@&${r}>`).join(' ') : ''}`, embeds: [ticketEmbed], components: [ticketButtons] });
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('// Sélectionne une catégorie');
        (cfg.ticket_options || []).forEach(opt => {
            selectMenu.addOptions({ label: opt.label, description: opt.description, value: opt.value, emoji: opt.emoji });
        });
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await i.update({ components: [row] }).catch(() => {});

        await i.followUp({ content: `✅ Ton ticket a été créé ici : ${channel}`, ephemeral: true });
    }

    if (i.isButton() && (i.customId === 'close_ticket' || i.customId === 'close_transcript_ticket')) {
        await i.reply({ content: '🔒 Fermeture du ticket...', ephemeral: true });
        if (i.customId === 'close_transcript_ticket') {
            try {
                const messages = await i.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
                const buffer = Buffer.from(transcript, 'utf-8');
                await i.user.send({
                    content: `📄 Transcript de ton ticket :`,
                    files: [{ attachment: buffer, name: `transcript-${i.channel.name}.txt` }]
                }).catch(() => {});
            } catch (e) {}
        }
        setTimeout(() => { i.channel.delete().catch(() => {}); }, 3000);
    }
});

http.createServer((req, res) => res.end('Bot CDE actif')).listen(process.env.PORT || 10000, '0.0.0.0');
client.login(process.env.DISCORD_TOKEN);
                
