const express = require('express');
const session = require('express-session');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

app.use(session({
  secret: 'lacentrale_securite_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

const LOGO_URL = '/1785187451514.png'; 

const HEADER_HTML = `
  <style>
    .menu-container { position: relative; }
    #menu-toggle { display: none; }
    .menu-icon { cursor: pointer; font-size: 26px; color: #f97316; padding: 4px 10px; border: 1px solid #f97316; border-radius: 6px; user-select: none; }
    .nav-menu { display: none; position: absolute; right: 0; top: 45px; background: #1c1917; border: 2px solid #f97316; border-radius: 8px; padding: 12px; z-index: 1000; min-width: 200px; }
    #menu-toggle:checked ~ .nav-menu { display: block; }
    .nav-menu a { display: block; color: #ffffff; text-decoration: none; padding: 8px; font-weight: bold; border-bottom: 1px solid #292524; font-size: 14px; }
    .nav-menu a:last-child { border-bottom: none; }
    .nav-menu a:hover { color: #f97316; }
  </style>
  <header style="display:flex; align-items:center; justify-content:space-between; padding:15px 20px; background:#0c0a09; border-bottom:2px solid #f97316; margin-bottom:25px;">
    <div style="display:flex; align-items:center; gap:12px;">
        <img src="${LOGO_URL}" width="40" height="40" style="border-radius:50%; border:2px solid #f97316; object-fit:cover;" alt="Logo">
        <h1 style="margin:0; font-size:17px; color:#ffffff; font-weight:800;">LA CENTRALE <span style="color:#f97316;">FR SÉCURITÉ</span></h1>
    </div>
    <div class="menu-container">
        <input type="checkbox" id="menu-toggle">
        <label for="menu-toggle" class="menu-icon">☰</label>
        <div class="nav-menu">
            <a href="/">🏠 Accueil</a>
            <a href="/callback">⚙️ Mes Serveurs</a>
            <a href="/doc">📖 Documentation</a>
            <a href="/tos">📜 Conditions (ToS)</a>
            <a href="/privacy">🔒 Confidentialité</a>
        </div>
    </div>
  </header>
`;

const FOOTER_HTML = `
  <footer style="margin-top:40px; padding:20px; text-align:center; border-top:1px solid #292524; background:#0c0a09; color:#a8a29e; font-size:12px;">
    <p>© 2026 <span style="color:#f97316; font-weight:bold;">LA CENTRALE FR SÉCURITÉ</span> - Tous droits réservés.</p>
  </footer>
`;

// Helper base de données
function getConfig() {
  if (!fs.existsSync('./config.json')) fs.writeFileSync('./config.json', '{}');
  return JSON.parse(fs.readFileSync('./config.json', 'utf8'));
}
function saveConfig(data) {
  fs.writeFileSync('./config.json', JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => {
  if (req.session && req.session.token) return res.redirect('/callback');
  res.send(`
    <html lang="fr"><head><title>LA CENTRALE FR SÉCURITÉ</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{background:#0c0a09;color:white;font-family:sans-serif;margin:0;min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;}.card{background:#1c1917;padding:30px;border-radius:12px;text-align:center;max-width:400px;width:90%;margin:auto;border:2px solid #f97316;}.btn{background:#f97316;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:block;margin-top:20px;}</style></head>
    <body>${HEADER_HTML}<div class="card"><h2>Panel d'Administration</h2><p style="color:#d6d3d1;font-size:14px;">Connectez-vous pour configurer vos serveurs (Tickets, Warns, Anti-Spam).</p><a href="https://discord.com/oauth2/authorize?client_id=1531412187392901120&response_type=code&redirect_uri=https%3A%2F%2Flacentral-3s9x.onrender.com%2Fcallback&scope=identify+guilds" class="btn">Se connecter avec Discord</a></div>${FOOTER_HTML}</body></html>
  `);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code && (!req.session || !req.session.token)) return res.redirect('/');
  try {
    let accessToken = req.session.token;
    if (code && !accessToken) {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: '1531412187392901120',
          client_secret: process.env.CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: 'https://lacentral-3s9x.onrender.com/callback',
        }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return res.send('Erreur d authentification.');
      req.session.token = `${tokenData.token_type} ${tokenData.access_token}`;
      accessToken = req.session.token;
    }
    const user = await (await fetch('https://discord.com/api/users/@me', { headers: { authorization: accessToken } })).json();
    const guilds = await (await fetch('https://discord.com/api/users/@me/guilds', { headers: { authorization: accessToken } })).json();
    const adminGuilds = Array.isArray(guilds) ? guilds.filter(g => (g.permissions & 0x8) === 0x8) : [];
    
    let guildsHTML = adminGuilds.map(g => `
      <div style="background:#1c1917; padding:15px; border-radius:8px; margin:10px 0; display:flex; justify-content:space-between; align-items:center; border:1px solid #f97316;">
        <span style="font-weight:bold; color:white;">${g.name}</span>
        <a href="/dashboard/${g.id}" style="background:#f97316; color:white; padding:8px 14px; border-radius:6px; text-decoration:none; font-weight:bold;">⚙️ Gérer</a>
      </div>
    `).join('');

    res.send(`
      <html lang="fr"><head><title>Mes Serveurs</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{background:#0c0a09;color:white;font-family:sans-serif;margin:0;min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;}</style></head>
      <body>${HEADER_HTML}<div style="max-width:650px; width:90%; margin:auto;"><h2 style="text-align:center;">Bienvenue, <span style="color:#f97316;">${user.username || 'Utilisateur'}</span> !</h2>${guildsHTML || '<p style="text-align:center;">Aucun serveur trouvé.</p>'}</div>${FOOTER_HTML}</body></html>
    `);
  } catch (err) { res.send("Erreur lors du chargement des serveurs."); }
});

app.get('/dashboard/:guildId', async (req, res) => {
  if (!req.session || !req.session.token) return res.redirect('/');
  const guildId = req.params.guildId;
  const db = getConfig();
  const cfg = db[guildId] || { support_roles: '', ticket_cat: '', ticket_msg: 'Bonjour ! Un membre du staff va s occuper de votre ticket.', max_warns: 3, warn_action: 'timeout', antispam: 'on' };

  res.send(`
    <html lang="fr"><head><title>Dashboard</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{background:#0c0a09;color:white;font-family:sans-serif;margin:0;padding:0;}.content{max-width:700px;width:90%;margin:auto;}.card{background:#1c1917;padding:20px;border-radius:10px;margin-bottom:15px;border:1px solid #f97316;}h3{color:#f97316;margin-top:0;}input,select{width:100%;padding:10px;margin-top:5px;background:#0c0a09;color:white;border:1px solid #44403c;border-radius:6px;box-sizing:border-box;margin-bottom:10px;}.btn{background:#f97316;color:white;padding:12px;border:none;border-radius:6px;width:100%;font-weight:bold;cursor:pointer;margin-top:10px;}</style></head>
    <body>${HEADER_HTML}<div class="content"><h2>⚙️ Configuration Serveur</h2><form action="/save-config/${guildId}" method="POST">
    
    <div class="card">
      <h3>🛡️ Équipe Support (Multi-Rôles)</h3>
      <label>IDs des Rôles Support (séparés par des virgules) :</label>
      <input type="text" name="support_roles" value="${cfg.support_roles}" placeholder="Ex: 1122334455, 6677889900">
    </div>

    <div class="card">
      <h3>🎫 Système de Tickets</h3>
      <label>ID Catégorie des Tickets :</label>
      <input type="text" name="ticket_cat" value="${cfg.ticket_cat}" placeholder="Ex: 9988776655">
      <label>Message d'accueil automatique :</label>
      <input type="text" name="ticket_msg" value="${cfg.ticket_msg}">
    </div>

    <div class="card">
      <h3>⚠️ Warns & Sanctions</h3>
      <label>Nombre de Warns max avant sanction :</label>
      <input type="number" name="max_warns" value="${cfg.max_warns}">
      <label>Sanction automatique :</label>
      <select name="warn_action">
        <option value="timeout" ${cfg.warn_action === 'timeout' ? 'selected' : ''}>⏱️ Time-out (10 minutes)</option>
        <option value="kick" ${cfg.warn_action === 'kick' ? 'selected' : ''}>👢 Kick (Expulsion)</option>
        <option value="ban" ${cfg.warn_action === 'ban' ? 'selected' : ''}>🔨 Ban (Bannissement)</option>
      </select>
    </div>

    <div class="card">
      <h3>🛡️ Anti-Spam Calmos</h3>
      <label>État de l'Anti-Spam (6 messages en 5 sec max) :</label>
      <select name="antispam">
        <option value="on" ${cfg.antispam === 'on' ? 'selected' : ''}>✅ Activé (Calmos)</option>
        <option value="off" ${cfg.antispam === 'off' ? 'selected' : ''}>❌ Désactivé</option>
      </select>
    </div>

    <button type="submit" class="btn">💾 Enregistrer les réglages</button>
    </form></div>${FOOTER_HTML}</body></html>
  `);
});

app.post('/save-config/:guildId', (req, res) => {
  const guildId = req.params.guildId;
  const db = getConfig();
  db[guildId] = {
    support_roles: req.body.support_roles || '',
    ticket_cat: req.body.ticket_cat || '',
    ticket_msg: req.body.ticket_msg || 'Bonjour !',
    max_warns: parseInt(req.body.max_warns) || 3,
    warn_action: req.body.warn_action || 'timeout',
    antispam: req.body.antispam || 'on'
  };
  saveConfig(db);
  res.send(`<html lang="fr"><body style="background:#0c0a09;color:white;font-family:sans-serif;text-align:center;padding-top:50px;"><h1 style="color:#22c55e;">✅ Réglages enregistrés !</h1><a href="/dashboard/${guildId}" style="color:#f97316;font-weight:bold;">← Retour au Dashboard</a></body></html>`);
});

app.get('/doc', (req, res) => {
  res.send(`<html lang="fr"><head><style>body{background:#0c0a09;color:white;font-family:sans-serif;margin:0;padding:20px;line-height:1.6;}</style></head><body>${HEADER_HTML}<div style="max-width:700px;margin:auto;"><h2>📖 Documentation</h2><p><strong>Anti-Spam :</strong> Bloque les spams à partir de 6 messages en moins de 5 secondes.</p><p><strong>Tickets :</strong> Ouverture de tickets sécurisés gérés par vos rôles supports.</p><p><strong>Warns :</strong> Sanctions automatiques paramétrables (Time-out, Kick, Ban).</p></div>${FOOTER_HTML}</body></html>`);
});

app.get('/tos', (req, res) => {
  res.send(`<html lang="fr"><head><style>body{background:#0c0a09;color:white;font-family:sans-serif;margin:0;padding:20px;line-height:1.6;}</style></head><body>${HEADER_HTML}<div style="max-width:700px;margin:auto;"><h2>📜 Conditions Générales d'Utilisation (ToS)</h2><p><strong>1. Acceptation :</strong> En ajoutant le bot, vous acceptez les conditions d'utilisation.</p><p><strong>2. Sécurité :</strong> Tout abus d'API ou tentative de raider entraînera un ban du service.</p></div>${FOOTER_HTML}</body></html>`);
});

app.get('/privacy', (req, res) => {
  res.send(`<html lang="fr"><head><style>body{background:#0c0a09;color:white;font-family:sans-serif;margin:0;padding:20px;line-height:1.6;}</style></head><body>${HEADER_HTML}<div style="max-width:700px;margin:auto;"><h2>🔒 Politique de Confidentialité</h2><p><strong>Données :</strong> Seules les données strictes de configuration (IDs serveurs, rôles) sont conservées.</p></div>${FOOTER_HTML}</body></html>`);
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.listen(PORT, () => console.log(`Dashboard prêt sur le port ${PORT}`));

// Démarre aussi le bot Discord
require('./bot.js');
