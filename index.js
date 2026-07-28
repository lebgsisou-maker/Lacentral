const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire les formulaires POST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuration de la session
app.use(session({
  secret: 'ma_cle_secrete_super_securisee_123',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(express.static('public'));

// 🖼️ URL de TON logo Discord
const LOGO_URL = 'https://cdn.discordapp.com/attachments/1531658635254566992/1531733054161289307/1785187451514.png?ex=6a6a4912&is=6a68f792&hm=2cc6039484d64af25fef6bfc595eebf483f3fa08a223aeda147dfad9e4f862c9&'; 

// 1. Page d'accueil (Connexion / Inscription Pro)
app.get('/', (req, res) => {
  // Si déjà connecté, rediriger vers les serveurs
  if (req.session && req.session.token) {
    return res.redirect('/callback');
  }

  res.send(`
    <html lang="fr">
      <head>
        <title>La Centrale - Authentification</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            background-color: #0f172a;
            color: #ffffff;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background-color: #1e293b;
            padding: 40px 30px;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            text-align: center;
            max-width: 420px;
            width: 100%;
            border: 1px solid #334155;
          }
          .logo {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            margin-bottom: 20px;
            border: 3px solid #38bdf8;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
            object-fit: cover;
          }
          h1 { font-size: 24px; margin-bottom: 8px; color: #ffffff; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 25px; line-height: 1.5; }
          
          .btn-group { display: flex; flex-direction: column; gap: 12px; }
          
          .btn {
            padding: 12px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            font-size: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: transform 0.1s, opacity 0.2s;
            border: none;
            cursor: pointer;
          }
          .btn:hover { opacity: 0.9; transform: translateY(-2px); }
          
          .btn-discord { background-color: #5865F2; color: white; }
          .btn-google { background-color: #ffffff; color: #333333; }
          
          .divider {
            margin: 20px 0;
            display: flex;
            align-items: center;
            color: #64748b;
            font-size: 12px;
          }
          .divider::before, .divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #334155;
          }
          .divider span { padding: 0 10px; }
        </style>
      </head>
      <body>
        <div class="card">
          <img src="${LOGO_URL}" alt="Logo La Centrale" class="logo">
          <h1>La Centrale</h1>
          <p>Connectez-vous pour accéder à votre espace de gestion et configurer vos serveurs.</p>
          
          <div class="btn-group">
            <!-- Bouton Discord -->
            <a href="https://discord.com/oauth2/authorize?client_id=1531412187392901120&response_type=code&redirect_uri=https%3A%2F%2Flacentral-3s9x.onrender.com%2Fcallback&scope=identify+guilds" class="btn btn-discord">
              <svg width="20" height="20" fill="white" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.64-27.38-4.51-51.11-20.08-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.92,53.86,53,48.81,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5.08-12.74,11.44-12.74S96.2,45.92,96.07,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Continuer avec Discord
            </a>

            <!-- Bouton Google -->
            <button onclick="alert('La connexion Google arrive bientôt ! Utilisez Discord pour le moment.')" class="btn btn-google">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.14C3.25 21.27 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.14z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.73 1.27 6.59l4.01 3.14c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              Continuer avec Google
            </button>
          </div>
        </div>
      </body>
    </html>
  `);
});

// 2. Page des serveurs (Après connexion)
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
      if (!tokenData.access_token) return res.send('Erreur lors de la récupération du token Discord.');

      req.session.token = `${tokenData.token_type} ${tokenData.access_token}`;
      accessToken = req.session.token;
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: accessToken },
    });
    const user = await userResponse.json();

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { authorization: accessToken },
    });
    const guilds = await guildsResponse.json();

    const adminGuilds = Array.isArray(guilds) ? guilds.filter(g => (g.permissions & 0x8) === 0x8) : [];

    let guildsHTML = adminGuilds.map(g => `
      <div style="background:#1e293b; padding:15px; border-radius:8px; margin:10px 0; display:flex; justify-content:space-between; align-items:center; border: 1px solid #334155;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" width="45" style="border-radius:50%;">` : '🛡️'}
          <span style="font-weight:bold; font-size:16px;">${g.name}</span>
        </div>
        <a href="/dashboard/${g.id}" style="background:#22c55e; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:bold;">⚙️ Gérer</a>
      </div>
    `).join('');

    res.send(`
      <html lang="fr">
        <head>
          <title>La Centrale - Vos Serveurs</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="background:#0f172a; color:white; font-family:sans-serif; padding:20px; max-width:650px; margin:auto;">
          <div style="text-align:center; margin-bottom: 20px;">
            <img src="${LOGO_URL}" width="80" height="80" style="border-radius:50%; border:2px solid #38bdf8; object-fit:cover;">
            <h2>Bienvenue, ${user.username} ! 👋</h2>
            <p style="color:#94a3b8;">Sélectionnez un serveur pour ouvrir le Dashboard :</p>
            <a href="/logout" style="color:#ef4444; text-decoration:none; font-size:13px; font-weight:bold;">Se déconnecter</a>
          </div>
          <hr style="border-color:#334155; margin-bottom:20px;">
          ${guildsHTML || '<p style="text-align:center; color:#94a3b8;">Aucun serveur trouvé où tu es administrateur.</p>'}
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.send("Une erreur s'est produite lors de la connexion.");
  }
});

// 3. Page Dashboard du Serveur (Tickets, Support, Modération)
app.get('/dashboard/:guildId', async (req, res) => {
  const guildId = req.params.guildId;

  if (!req.session || !req.session.token) {
    return res.redirect('/');
  }

  try {
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { authorization: req.session.token },
    });
    const guilds = await guildsResponse.json();

    const guild = Array.isArray(guilds) ? guilds.find(g => g.id === guildId) : null;

    if (!guild) {
      return res.send("Serveur introuvable ou vous n'avez pas les permissions.");
    }

    res.send(`
      <html lang="fr">
        <head>
          <title>Dashboard - ${guild.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background:#0f172a; color:white; font-family:sans-serif; padding:20px; max-width:700px; margin:auto; }
            .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
            .card { background:#1e293b; padding:20px; border-radius:10px; margin-bottom:20px; border:1px solid #334155; }
            h3 { margin-top:0; color:#38bdf8; display:flex; align-items:center; gap:8px; }
            label { font-weight:bold; display:block; margin-top:10px; color:#cbd5e1; }
            input, select { width:100%; padding:10px; border-radius:6px; border:1px solid #475569; margin-top:5px; background:#0f172a; color:white; box-sizing:border-box; }
            .btn { background:#22c55e; color:white; border:none; padding:12px 20px; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:15px; width:100%; font-size:16px; }
            .btn:hover { background:#16a34a; }
            small { color:#94a3b8; font-size:12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>⚙️ Dashboard : ${guild.name}</h2>
            <img src="${LOGO_URL}" width="45" height="45" style="border-radius:50%; border:2px solid #38bdf8; object-fit:cover;">
          </div>
          <a href="/callback" style="color:#38bdf8; text-decoration:none; font-weight:bold;">← Retour à la liste des serveurs</a>
          <hr style="border-color:#334155; margin:20px 0;">

          <form action="/save-config/${guild.id}" method="POST">
            
            <div class="card">
              <h3>🛠️ Configuration du Support</h3>
              <label for="support_roles">Rôles de l'équipe Support (Sélection Multiple) :</label>
              <select name="support_roles[]" id="support_roles" multiple size="4">
                <option value="111111111111111111">🛡️ Admin</option>
                <option value="222222222222222222">⚔️ Modérateur</option>
                <option value="333333333333333333">🎧 Support Ticket</option>
                <option value="444444444444444444">🤖 Assistant</option>
              </select>
              <small>💡 Maintiens la touche Ctrl ou appuie longuement sur mobile pour sélectionner plusieurs rôles.</small>
            </div>

            <div class="card">
              <h3>🎫 Configuration des Tickets</h3>
              <label>ID du Salon / Catégorie des Tickets :</label>
              <input type="text" name="ticket_category" placeholder="Ex: 123456789012345678">
              
              <label>Message de bienvenue du Ticket :</label>
              <input type="text" name="ticket_message" value="Bonjour ! Expliquez votre problème, un membre du staff va vous répondre.">
            </div>

            <div class="card">
              <h3>⚠️ Système de Warn</h3>
              <label>Nombre de Warns max avant Sanction automatique :</label>
              <input type="number" name="max_warns" value="3" min="1" max="10">
              
              <label>Sanction automatique après Warn max :</label>
              <select name="warn_action">
                <option value="timeout">⏱️ Time Out (Mute temporaire)</option>
                <option value="kick">👢 Kick (Expulser)</option>
                <option value="ban">🔨 Ban (Bannir)</option>
              </select>
            </div>

            <div class="card">
              <h3>🔨 Modération (Time Out & Ban)</h3>
              <label>Durée par défaut du Time Out (en minutes) :</label>
              <input type="number" name="default_timeout" value="60">

              <label>Raison par défaut du Bannissement :</label>
              <input type="text" name="default_ban_reason" value="Violation des règles de La Centrale.">
            </div>

            <button type="submit" class="btn">💾 Enregistrer toute la configuration</button>
          </form>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors du chargement du serveur.");
  }
});

// 4. Route pour sauvegarder la configuration
app.post('/save-config/:guildId', (req, res) => {
  const guildId = req.params.guildId;
  const config = req.body;

  console.log(`Données enregistrées pour le serveur ${guildId} :`, config);

  res.send(`
    <html lang="fr">
      <body style="background:#0f172a; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
        <h1 style="color:#22c55e;">✅ Configuration Enregistrée !</h1>
        <p>Les paramètres ont été mis à jour avec succès.</p>
        <br>
        <a href="/dashboard/${guildId}" style="background:#5865F2; color:white; padding:10px 20px; border-radius:5px; text-decoration:none; font-weight:bold;">Retour au Dashboard</a>
      </body>
    </html>
  `);
});

// 5. Route de déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// 6. Lancement du serveur Web
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));

