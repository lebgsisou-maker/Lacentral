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

const getConfig = (id) => {
    if (!fs.existsSync(CONFIG_FILE)) return { 
        embed_color: '#f97316', 
        log_channel: null, 
        anti_lien: true, 
        anti_raid: true,
        ticket_banner: 'https://i.imgur.com/3Z612u9.png',
        ticket_desc: "Une question, un souci ou une demande ?\nNotre équipe du Comité d'Ordre Éthique te répond en privé — vite et en toute confidentialité.",
        ticket_roles: [],
        ticket_options: [
            { label: 'Question générale', description: 'Une question sur le serveur', value: 'ticket_general', emoji: '<:cdetiquette:1538244268865364058>' },
            { label: 'Bug / Technique', description: 'Signaler un bug', value: 'ticket_bug', emoji: '<:cdesecurity:1538244159557865513>' },
            { label: 'Partenariat', description: 'Proposer un partenariat', value: 'ticket_partenariat', emoji: '<:cdemail:1538243884549677157>' },
            { label: 'Autre demande', description: 'Toute autre réclamation', value: 'ticket_autre', emoji: '<:cdediscord:1538243969539113121>' },
            { label: 'Recrutement Staff', description: 'Rejoindre le staff CDE', value: 'ticket_staff', emoji: '<:cdedossier:1538244218047307948>' }
        ]
    };
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[id] || { 
        embed_color: '#f97316', 
        log_channel: null, 
        anti_lien: true, 
        anti_raid: true,
        ticket_banner: 'https://i.imgur.com/3Z612u9.png',
        ticket_desc: "Une question, un souci ou une demande ?\nNotre équipe du Comité d'Ordre Éthique te répond en privé — vite et en toute confidentialité.",
        ticket_roles: [],
        ticket_options: [
            { label: 'Question générale', description: 'Une question sur le serveur', value: 'ticket_general', emoji: '<:cdetiquette:1538244268865364058>' },
            { label: 'Bug / Technique', description: 'Signaler un bug', value: 'ticket_bug', emoji: '<:cdesecurity:1538244159557865513>' },
            { label: 'Partenariat', description: 'Proposer un partenariat', value: 'ticket_partenariat', emoji: '<:cdemail:1538243884549677157>' },
            { label: 'Autre demande', description: 'Toute autre réclamation', value: 'ticket_autre', emoji: '<:cdediscord:1538243969539113121>' },
            { label: 'Recrutement Staff', description: 'Rejoindre le staff CDE', value: 'ticket_staff', emoji: '<:cdedossier:1538244218047307948>' }
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

const commands = [
    new SlashCommandBuilder().setName('config').setDescription('Panel de configuration CDE'),
    new SlashCommandBuilder().setName('blacklist').setDescription('Bannir un utilisateur').addUserOption(o => o.setName('utilisateur').setDescription('Personne').setRequired(true)).addStringOption(o => o.setName('raison').setDescription('Raison')),
    new SlashCommandBuilder().setName('antiraid').setDescription('Anti-raid').addBooleanOption(o => o.setName('etat').setDescription('true/false').setRequired(true)),
    new SlashCommandBuilder().setName('antilien').setDescription('Anti-lien').addBooleanOption(o => o.setName('etat').setDescription('true/false').setRequired(true)),
    new SlashCommandBuilder().setName('ticket-setup').setDescription('Envoyer le panneau de tickets').setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder().setName('set-ticket-desc').setDescription('Changer description').addStringOption(o => o.setName('description').setDescription('Texte').setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder().setName('set-ticket-banner').setDescription('Changer bannière').addStringOption(o => o.setName('url').setDescription('URL image').setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder().setName('set-color').setDescription('Changer couleur embed').addStringOption(o => o.setName('couleur').setDescription('Hex (ex: #5865F2)').setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder().setName('ticket-add-option').setDescription('Ajouter option ticket').addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true)).addStringOption(o => o.setName('description').setDescription('Desc').setRequired(true)).addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)).setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

client.once('ready', async () => {
    console.log(`[BOT CDE] Connecté : ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[COMMANDES] Enregistrées !');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const cfg = getConfig(i.guild.id);

    if (i.isChatInputCommand()) {
        if (i.commandName === 'config') {
            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('🛡️ Panel de Configuration — CDE')
                .setDescription("Gère la sécurité, les modules, la couleur et les rôles.")
                .addFields(
                    { name: '🔒 Anti-Lien', value: cfg.anti_lien ? '✅ Activé' : '❌ Désactivé', inline: true },
                    { name: '🚨 Anti-Raid', value: cfg.anti_raid ? '✅ Activé' : '❌ Désactivé', inline: true },
                    { name: '🎨 Couleur', value: `\`${cfg.embed_color}\``, inline: true }
                );
            const rowBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_lien').setStyle(cfg.anti_lien ? ButtonStyle.Danger : ButtonStyle.Success).setLabel('Anti-Lien'),
                new ButtonBuilder().setCustomId('toggle_raid').setStyle(cfg.anti_raid ? ButtonStyle.Danger : ButtonStyle.Success).setLabel('Anti-Raid')
            );
            const rowChan = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('log_chan').setChannelTypes(ChannelType.GuildText).setPlaceholder('Salon des logs'));
            const rowRoles = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('ticket_roles_select').setMinValues(1).setMaxValues(5).setPlaceholder('Rôles staff tickets'));
            await i.reply({ embeds: [embed], components: [rowBtn, rowChan, rowRoles], ephemeral: true });
        }

        if (i.commandName === 'blacklist') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
            const user = i.options.getUser('utilisateur');
            const reason = i.options.getString('raison') || 'Aucune raison';
            addBlacklist(i.guild.id, user.id);
            try {
                await i.guild.members.ban(user.id, { reason });
                await i.reply({ content: `✅ **${user.tag}** banni et blacklisté !`, ephemeral: true });
            } catch (e) {
                await i.reply({ content: `⚠️ Ajouté à la blacklist (échec du ban).`, ephemeral: true });
            }
        }

        if (i.commandName === 'antiraid' || i.commandName === 'antilien') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
            const etat = i.options.getBoolean('etat');
            const key = i.commandName === 'antiraid' ? 'anti_raid' : 'anti_lien';
            saveConfig(i.guild.id, { [key]: etat });
            await i.reply({ content: `✅ ${key} mis à jour : **${etat}**`, ephemeral: true });
        }

        if (i.commandName === 'set-ticket-desc') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
            const newDesc = i.options.getString('description');
            saveConfig(i.guild.id, { ticket_desc: newDesc });
            await i.reply({ content: `✅ Description mise à jour !`, ephemeral: true });
        }

        if (i.commandName === 'set-ticket-banner') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
            const url = i.options.getString('url');
            saveConfig(i.guild.id, { ticket_banner: url });
            await i.reply({ content: `✅ Bannière mise à jour !`, ephemeral: true });
        }

        if (i.commandName === 'set-color') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
            const color = i.options.getString('couleur');
            saveConfig(i.guild.id, { embed_color: color });
            await i.reply({ content: `✅ Couleur mise à jour sur **${color}** !`, ephemeral: true });
        }

        if (i.commandName === 'ticket-add-option') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
            const title = i.options.getString('titre');
            const desc = i.options.getString('description');
            const emoji = i.options.getString('emoji');
            let options = cfg.ticket_options || [];
            options.push({ label: title, description: desc, value: `ticket_${Date.now()}`, emoji: emoji });
            saveConfig(i.guild.id, { ticket_options: options });
            await i.reply({ content: `✅ Option **"${title}"** ajoutée !`, ephemeral: true });
        }

        if (i.commandName === 'ticket-setup') {
            const optionsList = (cfg.ticket_options || []).map(opt => `${opt.emoji} **${opt.label}** · ${opt.description}`).join('\n');
            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('⚖️ COMITÉ D\'ORDRE ÉTHIQUE — SUPPORT')
                .setDescription(`${cfg.ticket_desc}\n\n<:cdedossier:1538244218047307948> **Choisis le motif de ta demande**\n${optionsList}`)
                .setImage(cfg.ticket_banner)
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: '<:cdemail:1538243884549677157> Réponse en privé • <:cdesecurity:1538244159557865513> Confidentiel • <:cdehorloge:1538244050157703239> Prise en charge rapide • Propulsé par CDE' });

            const selectMenu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('// Sélectionne une catégorie');
            (cfg.ticket_options || []).forEach(opt => {
                selectMenu.addOptions({ label: opt.label, description: opt.description, value: opt.value, emoji: opt.emoji });
            });
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await i.channel.send({ embeds: [embed], components: [row] });
            await i.reply({ content: '✅ Panneau de tickets déployé !', ephemeral: true });
        }
    }

    if (i.isButton() && ['toggle_lien', 'toggle_raid'].includes(i.customId)) {
        if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Refusé.', ephemeral: true });
        const key = i.customId === 'toggle_lien' ? 'anti_lien' : 'anti_raid';
        const newState = !cfg[key];
        saveConfig(i.guild.id, { [key]: newState });
        await i.update({ content: `✅ ${key} mis à jour : **${newState}** (Refais /config)`, components: [] });
    }

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
            .setDescription(`Bienvenue ${i.user},\nUn membre du **Comité d'Ordre Éthique** va te prendre en charge.\n\nExplique ton problème ci-dessous.`)
            .setThumbnail(i.user.displayAvatarURL());

        const ticketButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setStyle(ButtonStyle.Danger).setLabel('Fermer').setEmoji('🔒'),
            new ButtonBuilder().setCustomId('close_transcript_ticket').setStyle(ButtonStyle.Secondary).setLabel('Fermer + Transcript').setEmoji('📄')
        );

        await channel.send({ content: `<@${i.user.id}> ${cfg.ticket_roles ? cfg.ticket_roles.map(r => `<@&${r}>`).join(' ') : ''}`, embeds: [ticketEmbed], components: [ticketButtons] });
        await i.reply({ content: `✅ Ton ticket a été créé ici : ${channel}`, ephemeral: true });
    }

    if (i.isButton() && (i.customId === 'close_ticket' || i.customId === 'close_transcript_ticket')) {
        await i.reply({ content: '🔒 Fermeture du ticket...', ephemeral: true });
        if (i.customId === 'close_transcript_ticket') {
            try {
                const messages = await i.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n');
                const buffer = Buffer.from(transcript, 'utf-8');
                await i.user.send({
                    content: `📄 Transcript de ton ticket sur **${i.guild.name}** :`,
                    files: [{ attachment: buffer, name: `transcript-${i.channel.name}.txt` }]
                }).catch(() => {});
            } catch (e) {}
        }
        setTimeout(() => { i.channel.delete().catch(() => {}); }, 3000);
    }

    if (i.isChannelSelectMenu() && i.customId === 'log_chan') {
        saveConfig(i.guild.id, { log_channel: i.values[0] });
        await i.reply({ content: `✅ Salon de logs configuré !`, ephemeral: true });
    }
});

client.on('guildMemberAdd', async (member) => {
    const cfg = getConfig(member.guild.id);
    if (getBlacklist(member.guild.id).includes(member.id)) {
        try { await member.ban({ reason: 'Blacklist CDE' }); return; } catch (e) {}
    }
});

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    const cfg = getConfig(message.guild.id);
    if (cfg.antilien) {
        const content = message.content.toLowerCase();
        const patterns = ['grabify.link', 'ipify.org', 'iplogger.', '2st.to', 'yip.su', 'blasze.com', 'discord-gifts.com', 'webhook.site'];
        if (patterns.some(p => content.includes(p))) {
            try {
                await message.delete();
                const w = await message.channel.send(`🚨 **ALERTE SÉCURITÉ** : ${message.author}, lien suspect bloqué !`);
                setTimeout(() => w.delete().catch(() => {}), 5000);
            } catch (e) {}
        }
    }
});

http.createServer((req, res) => res.end('Bot CDE actif')).listen(process.env.PORT || 10000, '0.0.0.0');
client.login(process.env.DISCORD_TOKEN);
        
