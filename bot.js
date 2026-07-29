const { 
    Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, StringSelectMenuBuilder, 
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const fs = require('fs');
// CETTE LIGNE EST ESSENTIELLE :
const discordTranscripts = require('discord-html-transcripts');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const CLIENT_ID = '1531412187392901120';

function getConfig(guildId) {
    if (!fs.existsSync('./config.json')) return null;
    const db = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    return db[guildId] || null;
}

function saveConfig(guildId, newData) {
    let db = fs.existsSync('./config.json') ? JSON.parse(fs.readFileSync('./config.json', 'utf8')) : {};
    db[guildId] = { ...db[guildId], ...newData };
    fs.writeFileSync('./config.json', JSON.stringify(db, null, 2));
}

const commands = [
    { 
        name: 'setup-tickets-support', 
        description: 'Configure le système de tickets',
        options: [
            { name: 'roles', type: 3, description: 'IDs rôles support (virgules)', required: true },
            { name: 'category', type: 3, description: 'ID catégorie', required: true },
            { name: 'text', type: 3, description: 'Message d\'accueil', required: true },
            { name: 'color', type: 3, description: 'Couleur hex (ex: #f97316)', required: true },
            { name: 'banner', type: 3, description: 'Lien image bannière', required: true }
        ]
    },
    { name: 'setup-panel', description: 'Envoie le menu des tickets' }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`Bot La Centrale en ligne sur ${client.user.tag} !`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Commandes Slash enregistrées !');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (interaction) => {
    
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-tickets-support') {
            saveConfig(interaction.guild.id, {
                support_roles: interaction.options.getString('roles'),
                ticket_cat: interaction.options.getString('category'),
                ticket_msg: interaction.options.getString('text'),
                embed_color: interaction.options.getString('color'),
                banner_url: interaction.options.getString('banner')
            });
            await interaction.reply({ content: '✅ Configuration sauvegardée !', ephemeral: true });
        }

        if (interaction.commandName === 'setup-panel') {
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Choisissez un motif')
                    .addOptions([
                        { label: '🔰 Contacter le Staff', value: 'staff' },
                        { label: '🤝 Partenariat & Collab', value: 'partenariat' },
                        { label: '❓ Question', value: 'question' },
                        { label: '❗ Signalement', value: 'report' },
                        { label: '🚨 Passage Prioritaire', value: 'urgent' }
                    ])
            );
            const embed = new EmbedBuilder().setTitle('🎫 Support - Menu').setDescription('Choisissez votre motif :').setColor('#f97316');
            await interaction.reply({ embeds: [embed], components: [menu] });
        }
    }

    // 2. Menu Sélection
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const modal = new ModalBuilder().setCustomId(`ticket_modal_${interaction.values[0]}`).setTitle('Détails du Ticket');
        const input = new TextInputBuilder()
            .setCustomId('server_type')
            .setLabel('Quel est le type de votre serveur ?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // 3. Soumission Modal (Création Ticket)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const type = interaction.customId.split('_')[2];
        const serverType = interaction.fields.getTextInputValue('server_type');
        const cfg = getConfig(interaction.guild.id);

        const channel = await interaction.guild.channels.create({
            name: `ticket-${type}-${interaction.user.username}`,
            parent: cfg ? cfg.ticket_cat : null
        });

        const embed = new EmbedBuilder()
            .setTitle(`Ticket : ${type}`)
            .setDescription(`**Utilisateur :** ${interaction.user}\n**Type de serveur :** ${serverType}\n\n${cfg ? cfg.ticket_msg : 'Bienvenue.'}`)
            .setColor(cfg ? cfg.embed_color : '#f97316')
            .setImage(cfg ? cfg.banner_url : null);

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeBtn] });
        await interaction.reply({ content: `✅ Ticket ouvert : ${channel}`, ephemeral: true });
    }

    // 4. Fermeture Ticket
    if (interaction.isButton() && interaction.customId === 'close_btn') {
        const modal = new ModalBuilder().setCustomId('close_modal').setTitle('Fermer le ticket');
        const input = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Pourquoi fermer ce ticket ?')
            .setStyle(TextInputStyle.Paragraph);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'close_modal') {
        await interaction.deferReply();
        const reason = interaction.fields.getTextInputValue('reason');
        
        // GÉNÉRATION TRANSCRIPT
        const transcript = await discordTranscripts.createTranscript(interaction.channel);
        
        try {
            await interaction.user.send({ 
                content: `Voici le transcript de votre ticket. Motif de fermeture : ${reason}`, 
                files: [transcript] 
            });
        } catch (e) { console.log("Impossible d'envoyer le MP"); }

        await interaction.channel.delete();
    }
});

client.login(process.env.DISCORD_TOKEN);
