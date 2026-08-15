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

const getConfig = (id) => {
    if (!fs.existsSync(CONFIG_FILE)) return { 
        embed_color: '#5865F2', 
        ticket_banner: 'https://i.imgur.com/3Z612u9.png',
        ticket_desc: "Une question, un souci ou une demande ?\nNotre équipe te répond en privé — vite et en toute confidentialité.",
        ticket_roles: [],
        ticket_options: [
            { label: 'Question générale', description: 'Une question sur le serveur ou autres ?', value: 'ticket_general', emoji: '<:cdesupport:1538273039609765918>' },
            { label: 'Bug / Problème technique', description: 'Signaler un bug ou un souci', value: 'ticket_bug', emoji: '<:cdeconfidialit:1538272990461042891>' },
            { label: 'Partenariat & collab', description: 'Proposer un partenariat', value: 'ticket_partenariat', emoji: '<:cdemail:1538272955350519920>' },
            { label: 'Autre', description: 'Toute autre réclamation', value: 'ticket_autre', emoji: '<:cdedossier:1538273514295918612>' },
            { label: 'Recrutement Staff', description: 'Salon des recrutements staff', value: 'ticket_staff', emoji: '<:cdehorloge:1538273017782861834>' }
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

const commands = [
    new SlashCommandBuilder().setName('config').setDescription('Ouvrir le panel de configuration'),
    new SlashCommandBuilder().setName('help').setDescription('Afficher l aide du bot'),
    new SlashCommandBuilder().setName('ticket-setup').setDescription('Déployer le panneau de tickets').setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
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
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('🛡️ Panel de Configuration CDE')
                .setDescription("Gère les rôles staff et la configuration.");

            const rowRoles = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('ticket_roles_select').setMinValues(1).setMaxValues(5).setPlaceholder('Sélectionner les rôles staff tickets')
            );

            await i.reply({ embeds: [embed], components: [rowRoles], ephemeral: true });
        }

        if (i.commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setTitle('📜 Aide — Bot CDE')
                .setDescription('`/config` : Ouvre le panel\n`/ticket-setup` : Envoie le panneau de tickets\n`/help` : Affiche ce message');
            await i.reply({ embeds: [helpEmbed], ephemeral: true });
        }

        if (i.commandName === 'ticket-setup') {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return i.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

            // Affichage propre sans les barres verticales encombrantes
            const optionsList = (cfg.ticket_options || []).map(opt => `${opt.emoji} **${opt.label}** · ${opt.description}`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(cfg.embed_color)
                .setImage(cfg.ticket_banner)
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
            .setDescription(`Bienvenue ${i.user},\nUn membre du staff va te prendre en charge.\n\nExplique ton problème ci-dessous.`)
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
