const { Client, GatewayIntentBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ComponentType } = require('discord.js');
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'secret_key_2026', resave: false, saveUninitialized: false }));

const CONFIG_FILE = './config.json';
function getConfig(guildId) {
    if (!fs.existsSync(CONFIG_FILE)) return { support_roles: [], ticket_cat: '', ticket_msg: 'Un membre du staff va arriver.', banner_url: '' };
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[guildId] || { support_roles: [], ticket_cat: '', ticket_msg: 'Un membre du staff va arriver.', banner_url: '' };
}
function saveConfig(guildId, newData) {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[guildId] = { ...getConfig(guildId), ...newData };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
}

// --- DASHBOARD (Tes routes) ---
app.get('/', (req, res) => res.send('<h1>Dashboard en ligne</h1>'));

// --- BOT DISCORD ---
client.once('ready', async () => {
    console.log(`✅ Bot en ligne : ${client.user.tag}`);
    const commands = [
        { name: 'setup-wizard', description: 'Configure rôles et catégorie' },
        { name: 'setup-panel', description: 'Envoie le menu de ticket' }
    ];
    await new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands('1531412187392901120'), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
    try {
        // --- 1. SETUP WIZARD ---
        if (interaction.isChatInputCommand()) {
            await interaction.deferReply({ ephemeral: true });
            if (interaction.commandName === 'setup-wizard') {
                const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Choisis les rôles staff').setMinValues(1).setMaxValues(5));
                const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Choisis la catégorie').setChannelTypes(ChannelType.GuildCategory));
                await interaction.editReply({ content: 'Sélectionne les paramètres :', components: [row, row2] });
            }
  if (interaction.commandName === 'setup-panel') {
    // 1. Définis ta couleur ici (tu peux changer le code hexadécimal)
    // Quelques idées : '#f97316' (Orange), '#3b82f6' (Bleu), '#ef4444' (Rouge)
    const maCouleur = '#f97316'; 

    const embed = new EmbedBuilder()
        .setTitle('🎫 CENTRE DE SUPPORT - LA CENTRALE')
        .setDescription(`
            **Bienvenue dans le centre de support.** 
            Merci de respecter le personnel et de faire preuve de patience. Toute demande inutile ou abusive pourra être sanctionnée. 
            
            Veuillez choisir le motif correspondant à votre demande pour être dirigé vers le salon approprié :

            🔰 **Staff** : Pour toute assistance modération ou problème technique.
            🤝 **Partenariat** : Pour proposer une collaboration avec notre serveur.
            ❓ **Question** : Si vous avez une interrogation sur le fonctionnement.
            ❗ **Signalement** : Pour rapporter un joueur ou un comportement inapproprié.
            🚨 **Urgent** : Passage prioritaire (À n'utiliser qu'en cas d'urgence réelle).
        `)
        .setColor(maCouleur) // C'est ici que tu gères la couleur !
        .setFooter({ text: 'La Centrale Sécurité - Protection & Support' })
        .setTimestamp();

    const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('Choisissez un motif')
        .addOptions([
            { label: '🔰 Contacter le Staff', value: 'staff' },
            { label: '🤝 Partenariat', value: 'partenariat' },
            { label: '❓ Question', value: 'question' },
            { label: '❗ Signalement', value: 'report' },
            { label: '🚨 Passage Prioritaire', value: 'urgent' }
        ]);

    // ephemeral: false permet à tout le monde de voir le message !
    await interaction.editReply({ 
        embeds: [embed], 
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: false 
    });
      }
            

        // --- 2. ENREGISTREMENT ---
        if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
            await interaction.deferReply({ ephemeral: true });
            if (interaction.customId === 'setup_roles') saveConfig(interaction.guild.id, { support_roles: interaction.values });
            if (interaction.customId === 'setup_cat') saveConfig(interaction.guild.id, { ticket_cat: interaction.values[0] });
            await interaction.editReply({ content: '✅ Sauvegardé !' });
        }

        // --- 3. OUVERTURE TICKET (SANS FORMULAIRE) ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            await interaction.deferReply({ ephemeral: true });
            const cfg = getConfig(interaction.guild.id);
            const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.values[0]}`, parent: cfg.ticket_cat || null });
            
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `${interaction.user}`, embeds: [new EmbedBuilder().setTitle('🎫 Ticket').setDescription(cfg.ticket_msg).setImage(cfg.banner_url || null)], components: [btn] });
            await interaction.editReply({ content: `✅ Ticket ouvert : ${channel}` });
        }

        // --- 4. FERMETURE & TRANSCRIPT ---
        if (interaction.isButton() && interaction.customId === 'close_btn') {
            await interaction.deferReply();
            const transcript = await discordTranscripts.createTranscript(interaction.channel);
            try { await interaction.user.send({ files: [transcript] }); } catch (e) {}
            await interaction.channel.delete();
        }

    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));

