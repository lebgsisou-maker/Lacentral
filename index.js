const { Client, GatewayIntentBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- CONFIGURATION ---
const CONFIG_FILE = './config.json';
function getConfig(guildId) {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const db = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return db[guildId] || { support_roles: [], ticket_cat: '', ticket_msg: 'Bonjour, un staff va s\'occuper de vous.', banner_url: '' };
}
function saveConfig(guildId, newData) {
    let db = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
    db[guildId] = { ...getConfig(guildId), ...newData };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(db, null, 2));
}

// --- BOT LOGIC ---
client.once('ready', async () => {
    console.log(`✅ Bot en ligne : ${client.user.tag}`);
    const commands = [
        { name: 'setup-wizard', description: 'Configure rôles et catégorie' },
        { name: 'setup-panel', description: 'Envoie le menu de ticket public' }
    ];
    await new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands('1531412187392901120'), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
    try {
        // --- 1. SETUP WIZARD ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'setup-wizard') {
            await interaction.deferReply({ ephemeral: true });
            const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_roles').setPlaceholder('Choisis les rôles staff').setMinValues(1).setMaxValues(5));
            const row2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup_cat').setPlaceholder('Choisis la catégorie').setChannelTypes(ChannelType.GuildCategory));
            await interaction.editReply({ content: 'Sélectionne les paramètres :', components: [row, row2] });
        }

        // --- 2. SETUP PANEL (LONG TEXT & COULEUR) ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'setup-panel') {
            await interaction.deferReply({ ephemeral: false }); // Public pour tout le monde
            
            const maCouleur = '#f97316'; // <--- CHANGE LA COULEUR ICI (Hex code)
            
            const embed = new EmbedBuilder()
                .setTitle('1. LA CENTRALE')
                .setColor(maCouleur)
                .setDescription(`
2. **Bienvenue au Centre de Support.**
3. Ce système est mis en place pour vous aider efficacement.
4. Avant d'ouvrir un ticket, merci de lire les consignes suivantes :
5. **Politesse :** Tout comportement irrespectueux sera sanctionné.
6. **Patience :** Un membre du staff vous répondra dès que possible.
7. **Clarté :** Expliquez votre problème avec précision.
8. **Sécurité :** Ne donnez jamais vos mots de passe.
9. **Respect :** Restez courtois en toute circonstance.
10. **Motifs disponibles :** Staff, Partenariat, Question, Signalement, Urgent.
11. **Abus :** L'ouverture de tickets inutiles est interdite.
12. **Spam :** Ne mentionnez pas le staff inutilement.
13. **Règles :** Le règlement du serveur s'applique ici aussi.
14. **Collaboration :** Travaillez avec nous pour résoudre les problèmes.
15. **Transparence :** Soyez honnête dans vos signalements.
16. **Langage :** Utilisez un langage correct et lisible.
17. **Preuves :** Si vous signalez quelqu'un, joignez des screens.
18. **Réactivité :** Répondez aux questions du staff rapidement.
19. **Non-toxique :** Aucun comportement toxique ne sera toléré.
20. **Support :** Nous sommes là pour améliorer votre expérience.
21. **Discrétion :** Le contenu de vos tickets est privé.
22. **Professionnalisme :** Nous attendons une attitude mature.
23. **Collaboration :** Merci de votre coopération précieuse.
24. **Entraide :** Aidez-nous à garder un serveur propre.
25. **Modération :** Le staff a toujours le dernier mot.
26. **Sanctions :** Le non-respect entraîne une fermeture du ticket.
27. **Fermeture :** Utilisez le bouton prévu pour fermer.
28. **Archive :** Un transcript sera envoyé après fermeture.
29. **Qualité :** Nous visons la qualité avant tout.
30. **Accueil :** Merci de respecter le staff dès l'arrivée.
31. **Confiance :** Nous construisons une relation de confiance.
32. **Objectif :** Résoudre vos soucis dans le calme.
33. **Merci de respecter les règles !**
                `);

            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choisis ton motif').addOptions([
                { label: '🔰 Staff', value: 'staff' }, { label: '🤝 Partenariat', value: 'partenariat' },
                { label: '❓ Question', value: 'question' }, { label: '❗ Signalement', value: 'report' }, { label: '🚨 Urgent', value: 'urgent' }
            ]);
            await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        }

        // --- 3. LOGIQUE D'ENREGISTREMENT & TICKETS ---
        if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
            await interaction.deferReply({ ephemeral: true });
            if (interaction.customId === 'setup_roles') saveConfig(interaction.guild.id, { support_roles: interaction.values });
            if (interaction.customId === 'setup_cat') saveConfig(interaction.guild.id, { ticket_cat: interaction.values[0] });
            await interaction.editReply({ content: '✅ Configuration sauvegardée !' });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            await interaction.deferReply({ ephemeral: true });
            const cfg = getConfig(interaction.guild.id);
            const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.values[0]}`, parent: cfg.ticket_cat || null });
            const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_btn').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger));
            await channel.send({ content: `${interaction.user}`, embeds: [new EmbedBuilder().setTitle('🎫 Ticket').setDescription(cfg.ticket_msg)], components: [btn] });
            await interaction.editReply({ content: `✅ Ticket ouvert : ${channel}` });
        }

        if (interaction.isButton() && interaction.customId === 'close_btn') {
            await interaction.deferReply();
            const transcript = await discordTranscripts.createTranscript(interaction.channel);
            try { await interaction.user.send({ files: [transcript] }); } catch (e) {}
            await interaction.channel.delete();
        }

    } catch (err) { console.error("Erreur critique :", err); }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, () => console.log(`Dashboard prêt sur port ${PORT}`));
