const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('La Centrale Sécurité est active ! 🛡️'));
app.listen(PORT);

const { 
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  AttachmentBuilder, REST, Routes, SlashCommandBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, AutoModerationRuleTriggerType, AutoModerationActionType
} = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.AutoModerationConfiguration
  ] 
});

const supportRoles = new Map(); 
const userWarns = new Map();

// Commandes Slash
const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Configure le panneau de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup-support-role')
    .setDescription('Définit le rôle staff qui gère les tickets')
    .addRoleOption(option => option.setName('role').setDescription('Le rôle staff').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup-automod')
    .setDescription('Créer 6 règles AutoMod sur ce serveur (Pack Badge 🛡️)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertir un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à avertir').setRequired(true))
    .addStringOption(opt => opt.setName('motif').setDescription('Motif du warn').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Exclure temporairement un membre (Mute)')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à mute').setRequired(true))
    .addIntegerOption(opt => opt.setName('duree').setDescription('Durée en minutes').setRequired(true))
    .addStringOption(opt => opt.setName('motif').setDescription('Motif de la sanction').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true))
    .addStringOption(opt => opt.setName('motif').setDescription('Motif du ban').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
].map(c => c.toJSON());

client.on('ready', async () => {
  console.log(`🛡️ Bot connecté : ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Commandes Slash enregistrées !");
  } catch (err) {
    console.error("Erreur d'enregistrement Slash:", err);
  }
});

// ANTI-SPAM ET ANTI-DOX (Pings massifs & IPs)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount >= 5) {
    await message.delete().catch(() => {});
    return message.channel.send(`⚠️ ${message.author}, les pings massifs ne sont pas autorisés !`);
  }

  const ipRegex = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

  if (ipRegex.test(message.content)) {
    await message.delete().catch(() => {});
    return message.channel.send(`🛡️ **La Centrale** : Message supprimé (détection d'adresse IP).`);
  }
});

// INTERACTION GESTION
client.on('interactionCreate', async (interaction) => {

  if (interaction.isChatInputCommand()) {
    
    if (interaction.commandName === 'setup-support-role') {
      const role = interaction.options.getRole('role');
      supportRoles.set(interaction.guild.id, role.id);
      return interaction.reply({ content: `✅ Rôle support défini sur : **${role.name}**`, ephemeral: true });
    }

    // PACK AUTOMOD OPTIMISÉ (6 règles d'un coup !)
    if (interaction.commandName === 'setup-automod') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const rulesToCreate = [
          { name: 'Centrale 1 - Anti-Links', keywords: ['*discord.gg/*', '*http://*', '*https://*'] },
          { name: 'Centrale 2 - Anti-Spam', keywords: ['*free nitro*', '*discord.gift*'] },
          { name: 'Centrale 3 - Anti-Grabber', keywords: ['*token*', '*grabber*'] },
          { name: 'Centrale 4 - Anti-Hacks', keywords: ['*hack*', '*cheat*'] },
          { name: 'Centrale 5 - Anti-Malware', keywords: ['*iplogger*', '*grabify*'] },
          { name: 'Centrale 6 - Anti-Scam', keywords: ['*giveaway*', '*win*'] }
        ];

        let createdCount = 0;
        for (const rule of rulesToCreate) {
          await interaction.guild.autoModerationRules.create({
            name: rule.name,
            creatorId: client.user.id,
            enabled: true,
            eventType: 1,
            triggerType: AutoModerationRuleTriggerType.Keyword,
            triggerMetadata: { keywordFilter: rule.keywords },
            actions: [{ type: AutoModerationActionType.BlockMessage }]
          }).catch(() => {});
          createdCount++;
        }

        return interaction.editReply({ content: `🛡️ **Pack AutoMod max appliqué !** ${createdCount} règles créées sur ce serveur.` });
      } catch (err) {
        return interaction.editReply({ content: `❌ Erreur : ${err.message}` });
      }
    }

    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Central Assistance — Support & Sécurité")
        .setDescription(
          "Bienvenue sur le centre d'assistance officiel de **La Centrale**.\n\n" +
          "📜 **Règlement & Consignes du Support :**\n" +
          "• Merci de **rester courtois et poli** envers l'équipe du Staff.\n" +
          "• Expliquez votre problème avec le plus de précisions possible.\n" +
          "• Tout abus ou spam de tickets sera sanctionné.\n" +
          "• Un membre du Staff prendra en charge votre demande dans les plus brefs délais.\n\n" +
          "👉 *Sélectionnez la catégorie adaptée à votre besoin dans le menu ci-dessous.*"
        )
        .setColor("#5865F2")
        .setFooter({ text: "La Centrale Sécurité — Protection & Assistance", iconURL: client.user.displayAvatarURL() });

      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('👉 Choisis ta catégorie...').addOptions([
          { label: 'Contacter le Staff', value: 'staff', emoji: '🔰' },
          { label: 'Partenariat & Collab', value: 'partenariat', emoji: '🤝' },
          { label: 'Signalement', value: 'signalement', emoji: '❗' },
          { label: 'Question', value: 'question', emoji: '❓' },
          { label: 'Urgent / Prioritaire', value: 'urgent', emoji: '🚨' }
        ])
      );
      await interaction.reply({ content: '✅ Panneau de ticket configuré !', ephemeral: true });
      return interaction.channel.send({ embeds: [embed], components: [menu] });
    }

    if (interaction.commandName === 'warn') {
      const user = interaction.options.getUser('membre');
      const reason = interaction.options.getString('motif');
      const count = (userWarns.get(user.id) || 0) + 1;
      userWarns.set(user.id, count);

      await user.send(`⚠️ **Avertissement de ${interaction.guild.name}** : ${reason}`).catch(() => {});
      return interaction.reply({ content: `⚠️ **${user.tag}** a été averti (Total Warns: ${count}). Motif : *${reason}*` });
    }

    if (interaction.commandName === 'timeout') {
      const member = interaction.options.getMember('membre');
      const duration = interaction.options.getInteger('duree');
      const reason = interaction.options.getString('motif');

      if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });

      await member.timeout(duration * 60 * 1000, reason).catch(() => {});
      return interaction.reply({ content: `🤐 **${member.user.tag}** a été mute pendant **${duration} minutes**. Motif : *${reason}*` });
    }

    if (interaction.commandName === 'ban') {
      const member = interaction.options.getMember('membre');
      const reason = interaction.options.getString('motif');

      if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });

      await member.ban({ reason }).catch(() => {});
      return interaction.reply({ content: `🔨 **${member.user.tag}** a été banni du serveur ! Motif : *${reason}*` });
    }
  }

  // CRÉATION DE TICKET
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const roleId = supportRoles.get(interaction.guild.id);
    const selectedValue = interaction.values[0];

    await interaction.message.edit({
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('👉 Choisis ta catégorie...').addOptions([
            { label: 'Contacter le Staff', value: 'staff', emoji: '🔰' },
            { label: 'Partenariat & Collab', value: 'partenariat', emoji: '🤝' },
            { label: 'Signalement', value: 'signalement', emoji: '❗' },
            { label: 'Question', value: 'question', emoji: '❓' },
            { label: 'Urgent / Prioritaire', value: 'urgent', emoji: '🚨' }
          ])
        )
      ]
    }).catch(() => {});

    const overwrites = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
    ];

    if (roleId) {
      overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      topic: interaction.user.id,
      permissionOverwrites: overwrites
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket — Catégorie : ${selectedValue.toUpperCase()}`)
      .setDescription(
        `Bonjour <@${interaction.user.id}>,\n\n` +
        "Un membre de notre équipe va prendre en charge votre demande d'ici quelques instants.\n" +
        "Merci d'expliquer clairement votre demande ci-dessous.\n\n" +
        "*Seul le Staff autorisé peut procéder à la fermeture de ce ticket.*"
      )
      .setColor("#28a745");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_close_simple').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('btn_close_transcript').setLabel('Fermer + Transcript MP').setStyle(ButtonStyle.Secondary).setEmoji('📑')
    );

    await channel.send({ content: `<@${interaction.user.id}> ${roleId ? `<@&${roleId}>` : ''}`, embeds: [embed], components: [row] });
    return interaction.reply({ content: `✅ Votre ticket a été créé : ${channel}`, ephemeral: true });
  }

  // BOUTON FERMETURE
  if (interaction.isButton()) {
    const roleId = supportRoles.get(interaction.guild.id);
    const hasModPerms = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasStaffRole = roleId && interaction.member.roles.cache.has(roleId);

    if (!hasModPerms && !hasStaffRole) {
      return interaction.reply({ 
        content: "⛔ **Accès Refusé** : Seul un membre du Staff possède la permission de fermer ce ticket.", 
        ephemeral: true 
      });
    }

    const isTranscript = interaction.customId === 'btn_close_transcript';
    const modal = new ModalBuilder()
      .setCustomId(isTranscript ? 'modal_close_transcript' : 'modal_close_simple')
      .setTitle('Fermeture du Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Motif de la fermeture')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex : Problème résolu...')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  // FORMULAIRE MOTIF
  if (interaction.isModalSubmit()) {
    const reason = interaction.fields.getTextInputValue('close_reason');

    if (interaction.customId === 'modal_close_simple') {
      await interaction.reply({ content: `🔒 **Fermeture du ticket** par ${interaction.user}.\n📝 **Motif :** *${reason}*\nSuppression dans 3 secondes...` });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }

    if (interaction.customId === 'modal_close_transcript') {
      await interaction.reply({ content: "📑 **Génération du transcript en cours...**" });

      const ticketOwnerId = interaction.channel.topic;
      const ticketOwner = await client.users.fetch(ticketOwnerId).catch(() => null);

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      let transcriptText = `==============================================\n`;
      transcriptText += `   TRANSCRIPT DU TICKET : #${interaction.channel.name}\n`;
      transcriptText += `   Fermé par : ${interaction.user.tag}\n`;
      transcriptText += `   Motif de fermeture : ${reason}\n`;
      transcriptText += `==============================================\n\n`;

      messages.reverse().forEach(msg => {
        if (!msg.author.bot || msg.embeds.length === 0) {
          transcriptText += `[${msg.createdAt.toLocaleString('fr-FR')}] ${msg.author.tag} : ${msg.content}\n`;
        }
      });

      const buffer = Buffer.from(transcriptText, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

      let sentInMp = false;
      if (ticketOwner) {
        try {
          await ticketOwner.send({
            content: `📑 **Transcript de ton ticket sur ${interaction.guild.name}**\n📝 **Motif de fermeture :** *${reason}*`,
            files: [attachment]
          });
          sentInMp = true;
        } catch (err) {}
      }

      const msgStatus = sentInMp ? "✅ Transcript envoyé en MP au créateur du ticket !" : "⚠️ MP fermés pour le créateur du ticket.";
      await interaction.channel.send({ content: `${msgStatus}\n📝 **Motif :** *${reason}*\n🔒 Suppression dans 3 secondes...` });

      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
  }
});

client.login(process.env.TOKEN);
        
