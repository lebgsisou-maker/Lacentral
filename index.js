const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('La Centrale est active ! 🛡️'));
app.listen(PORT);

const { 
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  AttachmentBuilder, REST, Routes, SlashCommandBuilder 
} = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

// Mémoire pour le rôle staff par serveur
const supportRoles = new Map(); 

const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Configure le panneau de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('setup-support-role')
    .setDescription('Définit le rôle qui gère les tickets')
    .addRoleOption(option => option.setName('role').setDescription('Le rôle staff').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

client.on('ready', async () => {
  console.log(`🛡️ Bot connecté : ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
  // 1. COMMANDES SLASH
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup-support-role') {
      const role = interaction.options.getRole('role');
      supportRoles.set(interaction.guild.id, role.id);
      await interaction.reply({ content: `✅ Rôle support défini sur : ${role.name}`, ephemeral: true });
    }
    
    if (interaction.commandName === 'setup-ticket') {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Central Assistance - Support & Sécurité")
        .setDescription("Besoin d'aide ? Choisissez l'option qui correspond à votre demande dans le menu déroulant :")
        .setColor("#5865F2");

      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('👉 Choisis ta catégorie...').addOptions([
          { label: 'Contacter le Staff', value: 'staff', emoji: '🔰' },
          { label: 'Partenariat & Collab', value: 'partenariat', emoji: '🤝' },
          { label: 'Signalement', value: 'signalement', emoji: '❗' },
          { label: 'Question', value: 'question', emoji: '❓' },
          { label: 'Urgent / Prioritaire', value: 'urgent', emoji: '🚨' }
        ])
      );
      await interaction.reply({ content: '✅ Panneau configuré avec succès !', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [menu] });
    }
  }

  // 2. CRÉATION DU TICKET VIA MENU DÉROULANT
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
    const roleId = supportRoles.get(interaction.guild.id);
    
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
      topic: interaction.user.id, // On sauvegarde l'ID du créateur dans le sujet du salon
      permissionOverwrites: overwrites
    });
    
    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket - ${interaction.values[0].toUpperCase()}`)
      .setDescription(`Bonjour <@${interaction.user.id}>,\nUn membre du staff va prendre en charge ta demande. Explique ton problème ci-dessous.\n\n*Utilisez les boutons ci-dessous pour gérer le salon.*`)
      .setColor("#28a745");

    // Boutons de gestion placés bien en haut du salon
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_simple').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('close_transcript').setLabel('Fermer + Transcript MP').setStyle(ButtonStyle.Secondary).setEmoji('📑')
    );

    await channel.send({ content: `<@${interaction.user.id}> ${roleId ? `<@&${roleId}>` : ''}`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ton ticket a été créé : ${channel}`, ephemeral: true });
  }

  // 3. FERMETURE ET TRANSCRIPT PAR LE STAFF
  if (interaction.isButton()) {
    const roleId = supportRoles.get(interaction.guild.id);
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || (roleId && interaction.member.roles.cache.has(roleId));

    if (!isStaff) {
      return interaction.reply({ content: "❌ Seul un membre du Staff peut fermer ce ticket !", ephemeral: true });
    }

    // A) FERMETURE SIMPLE
    if (interaction.customId === 'close_simple') {
      await interaction.reply("🔒 **Fermeture du ticket dans 3 secondes...**");
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }

    // B) FERMETURE + TRANSCRIPT EN MP
    if (interaction.customId === 'close_transcript') {
      await interaction.reply("📑 **Génération du transcript et envoi au membre...**");

      // On récupère l'ID du créateur du ticket qu'on avait sauvé dans le sujet du salon (topic)
      const ticketOwnerId = interaction.channel.topic; 
      const ticketOwner = await client.users.fetch(ticketOwnerId).catch(() => null);

      // Récupération des 100 derniers messages
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      let transcriptText = `==============================================\n`;
      transcriptText += `   TRANSCRIPT DU TICKET : #${interaction.channel.name}\n`;
      transcriptText += `   Fermé par : ${interaction.user.tag}\n`;
      transcriptText += `==============================================\n\n`;

      messages.reverse().forEach(msg => {
        if (!msg.author.bot || msg.embeds.length === 0) {
          transcriptText += `[${msg.createdAt.toLocaleString('fr-FR')}] ${msg.author.tag} : ${msg.content}\n`;
        }
      });

      const buffer = Buffer.from(transcriptText, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

      // Envoi du transcript en MP au membre qui a créé le ticket
      let sentInMp = false;
      if (ticketOwner) {
        try {
          await ticketOwner.send({
            content: `📑 **Voici le transcript de ton ticket sur le serveur ${interaction.guild.name} :**`,
            files: [attachment]
          });
          sentInMp = true;
        } catch (err) {
          console.log("Impossible d'envoyer le MP au membre (MP fermés).");
        }
      }

      const msgStatus = sentInMp ? "✅ Transcript envoyé en MP au membre !" : "⚠️ Impossible d'envoyer le MP au membre (ses MP sont fermés).";
      await interaction.channel.send({ content: `${msgStatus}\n🔒 Suppression du salon dans 3 secondes...` });

      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
  }
});

client.login(process.env.TOKEN);
