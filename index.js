// --- SERVEUR WEB POUR OUVRIR LE PORT RENDER ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('La Centrale Sécurité est opérationnelle ! 🛡️');
});

app.listen(PORT, () => {
  console.log(`Serveur web à l'écoute sur le port ${PORT}`);
});
// ----------------------------------------------

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Suivi pour l'Anti-Spam et l'Anti-Raid
const userMessages = new Map();
const recentJoins = [];

client.on('ready', () => {
  console.log(`🛡️ Bot La Centrale Sécurité connecté : ${client.user.tag}`);
});

// 1. ANTI-RAID : Détection d'arrivées massives de membres
client.on('guildMemberAdd', async (member) => {
  const now = Date.now();
  recentJoins.push(now);

  // Garde uniquement les arrivées des 10 dernières secondes
  const tenSecondsAgo = now - 10000;
  while (recentJoins.length > 0 && recentJoins[0] < tenSecondsAgo) {
    recentJoins.shift();
  }

  // Si plus de 5 personnes rejoignent en moins de 10 secondes -> Alerte Raid
  if (recentJoins.length >= 5) {
    console.warn(`🚨 ALERTE RAID détectée sur le serveur ${member.guild.name} !`);
    
    // Essaye de trouver un salon textuel pour prévenir les admins
    const systemChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(member.guild.members.me).has('SendMessages'));
    if (systemChannel) {
      systemChannel.send(`🚨 **ALERTE ANTI-RAID** : Détection d'une vague de rejointes suspectes (${recentJoins.length} membres en 10s) ! Les modérateurs sont invités à vérifier.`);
    }
  }
});

// 2. ANTI-DOX + ANTI-SPAM + ANTI-MASS MENTION
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const now = Date.now();
  const userId = message.author.id;

  // --- A. SYSTEME ANTI-DOX / LIENS SUSPECTS ---
  const liensInterdits = ['grabify.link', 'iplogger.org', '2no.co', 'statcounter.com', 'leakbyte.com'];
  const contientLienSuspect = liensInterdits.some(lien => message.content.toLowerCase().includes(lien));

  if (contientLienSuspect) {
    try {
      await message.delete();
      return message.channel.send(`⚠️ ${message.author}, les liens de ce type sont strictement interdits pour la sécurité du serveur !`);
    } catch (err) {
      console.error("Erreur suppression Anti-Dox :", err);
    }
  }

  // --- B. SYSTEME ANTI-RAID : MASS MENTION (@everyone / @here) ---
  if (message.mentions.everyone || message.mentions.roles.size > 3) {
    // Si l'utilisateur n'est pas admin et mentionne @everyone/@here
    if (!message.member.permissions.has('Administrator')) {
      try {
        await message.delete();
        return message.channel.send(`🚨 ${message.author}, les mentions massives sont interdites (Anti-Raid) !`);
      } catch (err) {
        console.error("Erreur suppression Mass-Mention :", err);
      }
    }
  }

  // --- C. SYSTEME ANTI-SPAM ---
  if (!userMessages.has(userId)) {
    userMessages.set(userId, []);
  }

  const timestamps = userMessages.get(userId);
  timestamps.push(now);

  // On garde les messages envoyés dans les 4 dernières secondes
  const fourSecondsAgo = now - 4000;
  const recentMessages = timestamps.filter(time => time > fourSecondsAgo);
  userMessages.set(userId, recentMessages);

  // Si l'utilisateur envoie plus de 4 messages en 4 secondes -> SPAM
  if (recentMessages.length >= 4) {
    try {
      await message.delete();
      
      // Envoie un avertissement s'il n'a pas déjà été prévenu
      if (recentMessages.length === 4) {
        const warningMsg = await message.channel.send(`⚠️ ${message.author}, calme le spam ! Tes messages sont supprimés.`);
        setTimeout(() => warningMsg.delete().catch(() => {}), 5000); // Supprime l'avertissement au bout de 5s
      }
    } catch (err) {
      console.error("Erreur suppression Anti-Spam :", err);
    }
  }
});

client.login(process.env.TOKEN);
        
