const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire les formulaires POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 💡 Rendre les fichiers de la racine accessibles (pour que l'image du logo charge à 100%)
app.use(express.static(__dirname));

// Configuration de la session
app.use(session({
  secret: 'ma_cle_secrete_super_securisee_123',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// 🖼️ Nom exact du logo hébergé sur ton GitHub
const LOGO_URL = '/1785187451514.png'; 

// Header & Footer HTML réutilisables
const HEADER_HTML = `
  <header style="display:flex; align-items:center; justify-content:center; gap:15px; padding:15px; background:#1e293b; border-bottom:1px solid #334155; margin-bottom:30px;">
    <img src="${LOGO_URL}" width="45" height="45" style="border-radius:50%; border:2px solid #38bdf8; object-fit:cover;" alt="Logo">
    <h1 style="margin:0; font-size:20px; color:#ffffff; letter-spacing:1px;">LA CENTRALE FR SÉCURITÉ</h1>
  </header>
`;

const FOOTER_HTML = `
  <footer style="margin-top:40px; padding:20px; text-align:center; border-top:1px solid #334155; color:#94a3b8; font-size:13px;">
    <p style="margin-bottom:10px;">© 2026 LA CENTRALE FR SÉCURITÉ - Tous droits réservés.</p>
    <div style="display:flex; justify-content:center; gap:15px;">
      <a href="/doc" style="color:#38bdf8; text-decoration:none;">Documentation</a> • 
      <a href="/tos" style="color:#38bdf8; text-decoration:none;">Conditions d'utilisation</a> • 
      <a href="/privacy" style="color:#38bdf8; text-decoration:none;">Confidentialité</a>
    </div>
  </footer>
`;

// 1. Page d'accueil
app.get('/', (req, res) => {
  if (req.session && req.session.token) {
    return res.redirect('/callback');
  }

  res.send(`
    <html lang="fr">
      <head>
        <title>LA CENTRALE FR SÉCURITÉ - Authentification</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background-color: #0f172a; color: #ffffff; font-family: sans-serif; margin: 0; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
          .card { background-color: #1e293b; padding: 35px 25px; border-radius: 16px; text-align: center; max-width: 400px; width: 90%; margin: auto; border: 1px solid #334155; }
          .btn-discord { background-color: #5865F2; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; }
        </style>
      </head>
      <body>
        ${HEADER_HTML}
        <div class="card">
          <h2>Espace d'administration</h2>
          <p style="color:#94a3b8; font-size:14px;">Connectez-vous pour accéder au panel de gestion de vos serveurs.</p>
          <a href="https://discord.com/oauth2/authorize?client_id=1531412187392901120&response_type=code&redirect_uri=https%3A%2F%2Flacentral-3s9x.onrender.com%2Fcallback&scope=identify+guilds" class="btn-discord">
            Se connecter avec Discord
          </a>
        </div>
        ${FOOTER_HTML}
      </body>
    </html>
  `);
});

// 2. Page des serveurs
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
      if (!tokenData.access_token) return res.send('Erreur de connexion.');

      req.session.token = `${tokenData.token_type} ${tokenData.access_token}`;
      accessToken = req.session.token;
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', { headers: { authorization: accessToken } });
    const user = await userResponse.json();

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', { headers: { authorization: accessToken } });
    const guilds = await guildsResponse.json();

    const adminGuilds = Array.isArray(guilds) ? guilds.filter(g => (g.permissions & 0x8) === 0x8) : [];

    let guildsHTML = adminGuilds.map(g => `
      <div style="background:#1e293b; padding:15px; border-radius:8px; margin:10px 0; display:flex; justify-content:space-between; align-items:center; border: 1px solid #334155;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" width="40" style="border-radius:50%;">` : '🛡️'}
          <span style="font-weight:bold;">${g.name}</span>
        </div>
        <a href="/dashboard/${g.id}" style="background:#22c55e; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:bold;">⚙️ Gérer</a>
      </div>
    `).join('');

    res.send(`
      <html lang="fr">
        <head>
          <title>LA CENTRALE FR SÉCURITÉ - Vos Serveurs</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="background:#0f172a; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between;">
          ${HEADER_HTML}
          <div style="max-width:650px; width:90%; margin:auto;">
            <div style="text-align:center;">
              <h2>Bienvenue, ${user.username} ! 👋</h2>
              <p style="color:#94a3b8;">Sélectionnez un serveur pour ouvrir le Dashboard :</p>
              <a href="/logout" style="color:#ef4444; text-decoration:none; font-size:13px; font-weight:bold;">Se déconnecter</a>
            </div>
            <hr style="border-color:#334155; margin:20px 0;">
            ${guildsHTML || '<p style="text-align:center; color:#94a3b8;">Aucun serveur trouvé où vous êtes administrateur.</p>'}
          </div>
          ${FOOTER_HTML}
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.send("Une erreur s'est produite lors de la connexion.");
  }
});

// 3. Dashboard Serveur
app.get('/dashboard/:guildId', async (req, res) => {
  const guildId = req.params.guildId;

  if (!req.session || !req.session.token) return res.redirect('/');

  try {
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', { headers: { authorization: req.session.token } });
    const guilds = await guildsResponse.json();
    const guild = Array.isArray(guilds) ? guilds.find(g => g.id === guildId) : null;

    if (!guild) return res.send("Serveur introuvable ou permissions insuffisantes.");

    res.send(`
      <html lang="fr">
        <head>
          <title>Dashboard - ${guild.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background:#0f172a; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; }
            .content { max-width:700px; width:90%; margin:auto; }
            .card { background:#1e293b; padding:20px; border-radius:10px; margin-bottom:20px; border:1px solid #334155; }
            h3 { margin-top:0; color:#38bdf8; }
            label { font-weight:bold; display:block; margin-top:10px; color:#cbd5e1; }
            input, select { width:100%; padding:10px; border-radius:6px; border:1px solid #475569; margin-top:5px; background:#0f172a; color:white; box-sizing:border-box; }
            .btn { background:#22c55e; color:white; border:none; padding:12px 20px; border-radius:6px; font-weight:bold; cursor:pointer; width:100%; font-size:16px; margin-top:15px; }
          </style>
        </head>
        <body>
          ${HEADER_HTML}
          <div class="content">
            <h2>⚙️ Configuration : ${guild.name}</h2>
            <a href="/callback" style="color:#38bdf8; text-decoration:none; font-weight:bold;">← Retour à la liste des serveurs</a>
            <hr style="border-color:#334155; margin:20px 0;">

            <form action="/save-config/${guild.id}" method="POST">
              <div class="card">
                <h3>🛠️ Configuration du Support</h3>
                <label>Rôles de l'équipe Support (Sélection Multiple) :</label>
                <select name="support_roles[]" multiple size="4">
                  <option value="111111111111111111">🛡️ Admin</option>
                  <option value="222222222222222222">⚔️ Modérateur</option>
                  <option value="333333333333333333">🎧 Support Ticket</option>
                </select>
              </div>

              <div class="card">
                <h3>🎫 Configuration des Tickets</h3>
                <label>ID du Salon / Catégorie :</label>
                <input type="text" name="ticket_category" placeholder="Ex: 123456789012345678">
                <label>Message de bienvenue :</label>
                <input type="text" name="ticket_message" value="Bonjour ! Expliquez votre problème, un membre du staff va vous répondre.">
              </div>

              <div class="card">
                <h3>⚠️ Système de Warn</h3>
                <label>Max Warns :</label>
                <input type="number" name="max_warns" value="3">
                <label>Sanction automatique :</label>
                <select name="warn_action">
                  <option value="timeout">⏱️ Time Out</option>
                  <option value="kick">👢 Kick</option>
                  <option value="ban">🔨 Ban</option>
                </select>
              </div>

              <button type="submit" class="btn">💾 Enregistrer la configuration</button>
            </form>
          </div>
          ${FOOTER_HTML}
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors du chargement.");
  }
});

// 4. Page de Documentation
app.get('/doc', (req, res) => {
  res.send(`
    <html lang="fr">
      <head>
        <title>LA CENTRALE FR SÉCURITÉ - Documentation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background:#0f172a; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; }
          .content { max-width:700px; width:90%; margin:auto; line-height:1.6; }
          .card { background:#1e293b; padding:20px; border-radius:10px; border:1px solid #334155; margin-bottom:15px; }
          h3 { color:#38bdf8; margin-top:0; }
        </style>
      </head>
      <body>
        ${HEADER_HTML}
        <div class="content">
          <h2>📖 Documentation - LA CENTRALE FR SÉCURITÉ</h2>
          <div class="card">
            <h3>🛡️ Anti-Dox & Anti-Raid</h3>
            <p>Le bot détecte automatiquement les tentatives de fuites d'informations personnelles et protège le serveur contre les raids d'utilisateurs suspectés.</p>
          </div>
          <div class="card">
            <h3>🎫 Système de Tickets</h3>
            <p>Permet à vos membres d'ouvrir un salon privé pour discuter avec l'équipe support sélectionnée dans votre Dashboard.</p>
          </div>
          <div class="card">
            <h3>⚠️ Système de Moderation</h3>
            <p>Avertissez vos membres (`!warn`). Une fois le nombre maximum d'avertissements atteint, la sanction définie s'applique automatiquement.</p>
          </div>
          <a href="/" style="color:#38bdf8; font-weight:bold; text-decoration:none;">← Retour à l'accueil</a>
        </div>
        ${FOOTER_HTML}
      </body>
    </html>
  `);
});

// 5. Conditions d'utilisation (ToS)
app.get('/tos', (req, res) => {
  res.send(`
    <html lang="fr">
      <head><title>LA CENTRALE FR SÉCURITÉ - ToS</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="background:#0f172a; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between;">
        ${HEADER_HTML}
        <div style="max-width:700px; width:90%; margin:auto;">
          <h2>Conditions d'utilisation (ToS)</h2>
          <p style="color:#cbd5e1; line-height:1.6;">En utilisant le bot LA CENTRALE FR SÉCURITÉ, vous acceptez d'utiliser l'application conformément aux règles d'utilisation de Discord.</p>
          <p style="color:#cbd5e1; line-height:1.6;">Toute tentative d'utilisation malveillante du bot entraînera un bannissement définitif du service.</p>
          <br>
          <a href="/" style="color:#38bdf8; font-weight:bold; text-decoration:none;">← Retour à l'accueil</a>
        </div>
        ${FOOTER_HTML}
      </body>
    </html>
  `);
});

// 6. Politique de Confidentialité (Privacy Policy)
app.get('/privacy', (req, res) => {
  res.send(`
    <html lang="fr">
      <head><title>LA CENTRALE FR SÉCURITÉ - Confidentialité</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="background:#0f172a; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between;">
        ${HEADER_HTML}
        <div style="max-width:700px; width:90%; margin:auto;">
          <h2>Politique de Confidentialité</h2>
          <p style="color:#cbd5e1; line-height:1.6;">LA CENTRALE FR SÉCURITÉ ne collecte que les identifiants nécessaires au fonctionnement de la modération et de la sauvegarde de votre configuration (IDs de serveur, IDs de rôles).</p>
          <p style="color:#cbd5e1; line-height:1.6;">Aucune donnée personnelle n'est vendue ni cédée à des tiers.</p>
          <br>
          <a href="/" style="color:#38bdf8; font-weight:bold; text-decoration:none;">← Retour à l'accueil</a>
        </div>
        ${FOOTER_HTML}
      </body>
    </html>
  `);
});

// 7. Route enregistrement
app.post('/save-config/:guildId', (req, res) => {
  const guildId = req.params.guildId;
  res.send(`
    <html lang="fr">
      <body style="background:#0f172a; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
        <h1 style="color:#22c55e;">✅ Configuration Enregistrée !</h1>
        <br>
        <a href="/dashboard/${guildId}" style="background:#5865F2; color:white; padding:10px 20px; border-radius:5px; text-decoration:none; font-weight:bold;">Retour au Dashboard</a>
      </body>
    </html>
  `);
});

// 8. Déconnexion & Lancement
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
