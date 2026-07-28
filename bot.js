const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Map pour anti-spam calmos
const userMessages = new Map();
// Warns DB temporaire / fichier
const userWarns = new Map();

function getConfig(guildId) {
  if (!fs.existsSync('./config.json')) return null;
  const db = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  return db[guildId] || null;
}

client.on('ready', () => {
  console.log(`Bot La Centrale en ligne sur ${client.user.tag} !`);
});

// --- ANTI-SPAM CALMOS & COMMANDES MESSAGES ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const cfg = getConfig(message.guild.id);

  // 1. Anti-Spam (Mode "Calmos" : 6 messages en 5 sec max)
  if (cfg && cfg.antispam === 'on') {
    const userId = message.author.id;
    const now = Date.now();

    if (!userMessages.has(userId)) {
      userMessages.set(userId, []);
    }

    const timestamps = userMessages.get(userId);
    timestamps.push(now);

    // Garde uniquement les timestamps de moins de 5 secondes
    const recent = timestamps.filter(t => now - t < 5000);
    userMessages.set(userId, recent);

    if (recent.length >= 6) {
      try {
        await message.delete();
        await message.channel.send(`⚠️ **Calmos ${message.author} !** Mollo sur les messages, pas de spam ici !`).then(m => setTimeout(() => m.delete(), 4000));
      } catch (err) {}
      return;
    }
  }

  // 2. Commandes d'administration (!warn, !setup-ticket)
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  // Commande pour poser le bouton de Ticket dans un salon
  if (message.content === '!setup-ticket') {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support - LA CENTRALE FR SÉCURITÉ')
      .setDescription('Cliquez sur le bouton ci-dessous pour ouvrir un ticket privé avec l’équipe support.')
      .setColor('#f97316');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_ticket').setLabel('📩 Ouvrir un Ticket').setStyle(ButtonStyle.Success)
    );

    message.channel.send({ embeds: [embed], components: [row] });
    message.delete();
  }

  // Commande !warn @user raison
  if (message.content.startsWith('!warn')) {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ Tu dois mentionner un membre à avertir.');

    const maxWarns = cfg ? cfg.max_warns : 3;
    const warnAction = cfg ? cfg.warn_action : 'timeout';

    let currentWarns = (userWarns.get(`${message.guild.id}-${target.id}`) || 0) + 1;
    userWarns.set(`${message.guild.id}-${target.id}`, currentWarns);

    message.channel.send(`⚠️ **${target.user.username}** a reçu un avertissement ! (${currentWarns}/${maxWarns})`);

    // Application de la sanction si le quota est atteint
    if (currentWarns >= maxWarns) {
      userWarns.set(`${message.guild.id}-${target.id}`, 0); // reset

      if (warnAction === 'timeout') {
        target.timeout(10 * 60 * 1000, 'Nombre max d avertissements atteint.');
        message.channel.send(`⏱️ **${target.user.username}** a été exclu temporairement (10 min) !`);
      } else if (warnAction === 'kick') {
        target.kick('Nombre max d avertissements atteint.');
        message.channel.send(`👢 **${target.user.username}** a été expulsé du serveur !`);
      } else if (warnAction === 'ban') {
        target.ban({ reason: 'Nombre max d avertissements atteint.' });
        message.channel.send(`🔨 **${target.user.username}** a été banni du serveur !`);
      }
    }
  }
});

// --- INTERACTIONS BOUTONS (TICKETS & FERMUTRE) ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const cfg = getConfig(interaction.guild.id);

  // OUVERTURE DE TICKET
  if (interaction.customId === 'open_ticket') {
    const categoryId = cfg ? cfg.ticket_cat : null;
    const supportRolesStr = cfg ? cfg.support_roles : '';
    const supportRoles = supportRolesStr.split(',').map(r => r.trim()).filter(r => r.length > 0);

    const permissionOverwrites = [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ];

    // Ajout de tous les rôles support configurés sur le panel
    supportRoles.forEach(roleId => {
      permissionOverwrites.push({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      });
    });

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId || null,
      permissionOverwrites: permissionOverwrites
    });

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger)
    );

    const welcomeMsg = cfg ? cfg.ticket_msg : 'Bonjour ! Un membre du staff va répondre à votre demande.';
    await ticketChannel.send({ content: `${interaction.user} ${welcomeMsg}`, components: [closeBtn] });

    await interaction.reply({ content: `✅ Ticket créé : ${ticketChannel}`, ephemeral: true });
  }

  // FERMETURE DE TICKET
  if (interaction.customId === 'close_ticket') {
    await interaction.reply('🔒 Le ticket va se fermer dans 3 secondes...');
    setTimeout(() => {
      interaction.channel.delete();
    }, 3000);
  }
});

client.login(process.env.DISCORD_TOKEN);
          
