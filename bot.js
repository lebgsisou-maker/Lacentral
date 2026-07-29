const { 
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, 
  REST, Routes 
} = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ID de ton application (trouvé dans ton index.js)
const CLIENT_ID = '1531412187392901120';

const userMessages = new Map();
const userWarns = new Map();

function getConfig(guildId) {
  if (!fs.existsSync('./config.json')) return null;
  const db = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  return db[guildId] || null;
}

// --- ENREGISTREMENT DES COMMANDES SLASH ---
const commands = [
  { name: 'ping', description: 'Vérifie si le bot répond' },
  { name: 'ticket', description: 'Ouvre un ticket de support' }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`Bot La Centrale en ligne sur ${client.user.tag} !`);
  
  // Enregistre les commandes Slash automatiquement
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Commandes Slash enregistrées avec succès !');
  } catch (error) {
    console.error('Erreur enregistrement Slash:', error);
  }
});

// --- COMMANDES MESSAGES (Préfixe !) ---
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const cfg = getConfig(message.guild.id);

  // Anti-Spam
  if (cfg && cfg.antispam === 'on') {
    const userId = message.author.id;
    const now = Date.now();
    if (!userMessages.has(userId)) userMessages.set(userId, []);
    const timestamps = userMessages.get(userId);
    timestamps.push(now);
    const recent = timestamps.filter(t => now - t < 5000);
    userMessages.set(userId, recent);
    if (recent.length >= 6) {
      try {
        await message.delete();
        await message.channel.send(`⚠️ **Calmos ${message.author} !**`).then(m => setTimeout(() => m.delete(), 4000));
      } catch (err) {}
      return;
    }
  }

  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  if (message.content === '!setup-ticket') {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support - LA CENTRALE FR SÉCURITÉ')
      .setDescription('Cliquez sur le bouton ci-dessous pour ouvrir un ticket.')
      .setColor('#f97316');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_ticket').setLabel('📩 Ouvrir un Ticket').setStyle(ButtonStyle.Success)
    );
    await message.channel.send({ embeds: [embed], components: [row] });
    message.delete();
  }
});

// --- INTERACTIONS (Boutons ET Slash Commands) ---
client.on('interactionCreate', async (interaction) => {
  
  // A. GESTION DES BOUTONS (Tickets)
  if (interaction.isButton()) {
    const cfg = getConfig(interaction.guild.id);

    if (interaction.customId === 'open_ticket') {
        const categoryId = cfg ? cfg.ticket_cat : null;
        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: categoryId || null
        });
        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger)
        );
        await ticketChannel.send({ content: `Ticket ouvert par ${interaction.user}`, components: [closeBtn] });
        await interaction.reply({ content: `✅ Ticket créé : ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.customId === 'close_ticket') {
      // FIX : deferUpdate pour éviter l'échec de l'interaction
      await interaction.deferUpdate();
      try {
        await interaction.channel.delete();
      } catch (e) { console.error("Erreur suppression:", e); }
    }
  }

  // B. GESTION DES COMMANDES SLASH (/)
  if (interaction.isChatInputCommand()) {
    // FIX : deferReply pour éviter l'erreur de délai
    await interaction.deferReply({ ephemeral: true });

    if (interaction.commandName === 'ping') {
      await interaction.editReply('🏓 Pong ! La Centrale est active.');
    } else if (interaction.commandName === 'ticket') {
        await interaction.editReply('Utilisez le panneau dans le salon support pour ouvrir un ticket.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

