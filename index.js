// ==========================================
// 1. SERVEUR WEB POUR RENDER
// ==========================================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('La Centrale Sécurité est opérationnelle ! 🛡️');
});

app.listen(PORT, () => {
  console.log(`Serveur web à l'écoute sur le port ${PORT}`);
});

// ==========================================
// 2. INITIALISATION ET SLASH COMMANDS
// ==========================================
const { 
  Client, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  AttachmentBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Enregistrement de la commande Slash /setup-ticket
const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Affiche le panneau de création de ticket support')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

const userWarns = new Map();

client.on('ready', async () => {
  console.log(`🛡️ Bot La Centrale Sécurité connecté : ${client.user.tag}`);

  // Enregistrement automatique des commandes / auprès de Discord
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    console.log('🔄 Enregistrement des commandes Slash (/)...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Commandes Slash enregistrées avec succès !');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des Slash Commands :', error);
  }
});

// ==========================================
// 3. SÉCURITÉ AVANCÉE (Anti-Spam, Anti-Ping, Anti-Dox)
// ==========================================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const content = message.content;

  // --- ANTI-MASS PING ---
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount >= 3) {
    await message.delete().catch(() => {});
    await message.channel.send(`⚠️ ${message.author}, les pings massifs ne sont pas autorisés !`);
    return applyWarn(message.member, "Pings massifs");
  }

  // --- ANTI-DOX & NETTOYAGE ZALGO ---
  const cleanContent = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const phoneRegex = /(?:(?:\+|00)33|0)[1-9](?:[\s.-]*\d{2}){4}/g;
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;

  if (phoneRegex.test(cleanContent) || ipRegex.test(cleanContent)) {
    await message.delete().catch(() => {});
    await message.channel.send(`🛡️ **La Centrale Security** : Message supprimé (détection de données sensibles).`);
    return applyWarn(message.member, "Tentative de Doxing / Fuite de données");
  }
});

async function applyWarn(member, reason) {
  const userId = member.id;
  const currentWarns = (userWarns.get(userId) || 0) + 1;
  userWarns.set(userId, currentWarns);

  if (currentWarns === 1) {
    member.send(`⚠️ **Avertissement [La Centrale]** : ${reason}. Attention aux récidives !`).catch(() => {});
  } else if (currentWarns === 2) {
    await member.timeout(10 * 60 * 1000, reason).catch(() => {});
  } else if (currentWarns >= 3) {
    await member.ban({ reason: `Récidive : ${reason}` }).catch(() => {});
  }
}

// ==========================================
// 4. GESTION DES COMMANDES ET TICKETS
// ==========================================

// Commande Slash /setup-ticket
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Central Assistance - Support & Sécurité")
        .setDescription("Choisissez la catégorie correspondant à votre demande dans le menu déroulant ci-dessous pour ouvrir un ticket.")
        .setColor("#5865F2");

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_ticket_category')
        .setPlaceholder('👉 Choisissez une option...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Signalement / Anti-Dox')
            .setDescription('Signaler une fuite de données, un raid ou un membre')
            .setValue('ticket_dox')
            .setEmoji('🛡️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Support Général')
            .setDescription('Poser une question ou demander de l\'aide au staff')
            .setValue('ticket_support')
            .setEmoji('❓'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Partenariat')
            .setDescription('Proposer un partenariat avec La Centrale')
            .setValue('ticket_partenariat')
            .setEmoji('🤝')
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({ content: '✅ Panneau de ticket configuré !', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  }

  // --- SELECTION DANS LE MENU DÉROULANT ---
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_ticket_category') {
      const category = interaction.values[0];
      let prefix = 'ticket';
      let categoryName = 'Support';

      if (category === 'ticket_dox') { prefix = 'dox'; categoryName = '🛡️ Signalement Dox/Sécurité'; }
      if (category === 'ticket_support') { prefix = 'help'; categoryName = '❓ Support Général'; }
      if (category === 'ticket_partenariat') { prefix = 'partenariat'; categoryName = '🤝 Partenariat'; }

      const channelName = `${prefix}-${interaction.user.username}`;
      const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName.toLowerCase());

      if (existingChannel) {
        return interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : ${existingChannel}`, ephemeral: true });
      }

      // Création du salon privé
      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
          },
        ],
      });

      const embedTicket = new EmbedBuilder()
        .setTitle(`🎫 Ticket : ${categoryName}`)
        .setDescription(`Bonjour <@${interaction.user.id}>,\nUn membre de l'équipe arrive. Explique ton problème ou ta demande en détail.`)
        .setColor("#28a745");

      const rowTicket = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Fermer le ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('transcript_close_ticket')
          .setLabel('Transcript + Fermer')
          .setEmoji('📑')
          .setStyle(ButtonStyle.Secondary)
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embedTicket], components: [rowTicket] });
      await interaction.reply({ content: `✅ Ton ticket a été créé : ${ticketChannel}`, ephemeral: true });
    }
  }

  // --- FERMETURE SIMPLE ---
  if (interaction.isButton()) {
    if (interaction.customId === 'close_ticket') {
      await interaction.reply("🔒 Fermeture du ticket dans 5 secondes...");
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    // --- TRANSCRIPT + FERMETURE ---
    if (interaction.customId === 'transcript_close_ticket') {
      await interaction.reply("📑 Génération du transcript en cours...");

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      let transcriptText = `--- TRANSCRIPT DU TICKET : ${interaction.channel.name} ---\n\n`;

      messages.reverse().forEach(msg => {
        transcriptText += `[${msg.createdAt.toLocaleString('fr-FR')}] ${msg.author.tag} : ${msg.content}\n`;
      });

      const buffer = Buffer.from(transcriptText, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

      await interaction.user.send({ content: `📑 Voici le transcript de votre ticket :`, files: [attachment] }).catch(() => {});
      await interaction.channel.send({ content: "✅ Transcript généré et envoyé en MP. Fermeture du salon...", files: [attachment] });

      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  }
});

// ==========================================
// 5. CONNEXION DU BOT
// ==========================================
client.login(process.env.TOKEN);
