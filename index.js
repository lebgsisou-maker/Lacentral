const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire les formulaires POST & JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Fichiers statiques à la racine (logo, etc.)
app.use(express.static(__dirname));

// Configuration de la session
app.use(session({
  secret: 'lacentrale_securite_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// 🖼️ Logo officiel
const LOGO_URL = '/1785187451514.png'; 

// Header réutilisable avec Menu Hamburger (Couleurs : Orange & Blanc)
const HEADER_HTML = `
  <style>
    .menu-container { position: relative; }
    #menu-toggle { display: none; }
    .menu-icon { cursor: pointer; font-size: 28px; color: #f97316; padding: 5px 10px; border: 1px solid #f97316; border-radius: 6px; user-select: none; }
    .menu-icon:hover { background: #f97316; color: #ffffff; }
    .nav-menu { display: none; position: absolute; right: 0; top: 50px; background: #1c1917; border: 2px solid #f97316; border-radius: 8px; padding: 15px; z-index: 1000; min-width: 220px; box-shadow: 0 10px 25px rgba(249, 115, 22, 0.2); }
    #menu-toggle:checked ~ .nav-menu { display: block; }
    .nav-menu a { display: block; color: #ffffff; text-decoration: none; padding: 10px; font-weight: bold; border-bottom: 1px solid #292524; font-size: 14px; }
    .nav-menu a:last-child { border-bottom: none; }
    .nav-menu a:hover { color: #f97316; background: #292524; border-radius: 4px; }
  </style>
  <header style="display:flex; align-items:center; justify-content:space-between; padding:15px 25px; background:#0c0a09; border-bottom:2px solid #f97316; margin-bottom:30px;">
    <div style="display:flex; align-items:center; gap:15px;">
        <img src="${LOGO_URL}" width="45" height="45" style="border-radius:50%; border:2px solid #f97316; object-fit:cover;" alt="Logo">
        <h1 style="margin:0; font-size:18px; color:#ffffff; letter-spacing:1px; font-weight:800;">LA CENTRALE <span style="color:#f97316;">FR SÉCURITÉ</span></h1>
    </div>
    <div class="menu-container">
        <input type="checkbox" id="menu-toggle">
        <label for="menu-toggle" class="menu-icon">☰</label>
        <div class="nav-menu">
            <a href="/">🏠 Accueil / Connexion</a>
            <a href="/callback">⚙️ Mes Serveurs</a>
            <a href="/doc">📖 Documentation</a>
            <a href="/tos">📜 Conditions d'utilisation</a>
            <a href="/privacy">🔒 Confidentialité</a>
        </div>
    </div>
  </header>
`;

// Footer réutilisable
const FOOTER_HTML = `
  <footer style="margin-top:50px; padding:25px; text-align:center; border-top:1px solid #292524; background:#0c0a09; color:#a8a29e; font-size:13px;">
    <p style="margin-bottom:10px; color:#ffffff;">© 2026 <span style="color:#f97316; font-weight:bold;">LA CENTRALE FR SÉCURITÉ</span> - Tous droits réservés.</p>
    <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
      <a href="/doc" style="color:#f97316; text-decoration:none;">Documentation</a> • 
      <a href="/tos" style="color:#f97316; text-decoration:none;">Conditions d'utilisation</a> • 
      <a href="/privacy" style="color:#f97316; text-decoration:none;">Confidentialité</a>
    </div>
  </footer>
`;

// ------------------- ROUTES -------------------

// 1. PAGE D'ACCUEIL
app.get('/', (req, res) => {
  if (req.session && req.session.token) {
    return res.redirect('/callback');
  }

  res.send(`
    <html lang="fr">
      <head>
        <title>LA CENTRALE FR SÉCURITÉ - Accueil</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background-color: #0c0a09; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
          .card { background-color: #1c1917; padding: 40px 30px; border-radius: 16px; text-align: center; max-width: 420px; width: 90%; margin: auto; border: 2px solid #f97316; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15); }
          .btn-discord { background-color: #f97316; color: #ffffff; padding: 14px 22px; border-radius: 8px; text-decoration: none; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 25px; transition: 0.2s; font-size: 16px; }
          .btn-discord:hover { background-color: #ea580c; transform: translateY(-2px); }
        </style>
      </head>
      <body>
        ${HEADER_HTML}
        <div class="card">
          <h2 style="color:#ffffff; margin-top:0;">Panel d'Administration</h2>
          <p style="color:#d6d3d1; font-size:14px; line-height:1.5;">Connectez-vous avec votre compte Discord pour configurer la sécurité, les tickets et les sanctions de vos serveurs.</p>
          <a href="https://discord.com/oauth2/authorize?client_id=1531412187392901120&response_type=code&redirect_uri=https%3A%2F%2Flacentral-3s9x.onrender.com%2Fcallback&scope=identify+guilds" class="btn-discord">
            Se connecter avec Discord
          </a>
        </div>
        ${FOOTER_HTML}
      </body>
    </html>
  `);
});

// 2. LISTE DES SERVEURS (CALLBACK)
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
      if (!tokenData.access_token) return res.send('Erreur d authentification Discord.');

      req.session.token = `${tokenData.token_type} ${tokenData.access_token}`;
      accessToken = req.session.token;
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', { headers: { authorization: accessToken } });
    const user = await userResponse.json();

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', { headers: { authorization: accessToken } });
    const guilds = await guildsResponse.json();

    const adminGuilds = Array.isArray(guilds) ? guilds.filter(g => (g.permissions & 0x8) === 0x8) : [];

    let guildsHTML = adminGuilds.map(g => `
      <div style="background:#1c1917; padding:18px; border-radius:10px; margin:12px 0; display:flex; justify-content:space-between; align-items:center; border: 1px solid #f97316;">
        <div style="display:flex; align-items:center; gap:15px;">
          ${g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" width="45" style="border-radius:50%; border:1px solid #f97316;">` : '<span style="font-size:24px;">🛡️</span>'}
          <span style="font-weight:bold; color:#ffffff; font-size:16px;">${g.name}</span>
        </div>
        <a href="/dashboard/${g.id}" style="background:#f97316; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:bold; transition:0.2s;">⚙️ Gérer</a>
      </div>
    `).join('');

    res.send(`
      <html lang="fr">
        <head>
          <title>LA CENTRALE - Mes Serveurs</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background:#0c0a09; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; }
          </style>
        </head>
        <body>
          ${HEADER_HTML}
          <div style="max-width:680px; width:90%; margin:auto;">
            <div style="text-align:center;">
              <h2 style="color:#ffffff;">Bienvenue, <span style="color:#f97316;">${user.username}</span> ! 👋</h2>
              <p style="color:#d6d3d1;">Sélectionnez le serveur Discord que vous souhaitez configurer :</p>
              <a href="/logout" style="color:#ef4444; text-decoration:none; font-size:13px; font-weight:bold;">Se déconnecter</a>
            </div>
            <hr style="border-color:#292524; margin:25px 0;">
            ${guildsHTML || '<p style="text-align:center; color:#a8a29e;">Aucun serveur trouvé où vous avez les permissions d administrateur.</p>'}
          </div>
          ${FOOTER_HTML}
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.send("Une erreur est survenue lors de la récupération des serveurs.");
  }
});

// 3. DASHBOARD DU SERVEUR (SUPPORT, TICKETS & WARNS)
app.get('/dashboard/:guildId', async (req, res) => {
  const guildId = req.params.guildId;

  if (!req.session || !req.session.token) return res.redirect('/');

  try {
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', { headers: { authorization: req.session.token } });
    const guilds = await guildsResponse.json();
    const guild = Array.isArray(guilds) ? guilds.find(g => g.id === guildId) : null;

    if (!guild) return res.send("Serveur non trouvé ou permissions insuffisantes.");

    res.send(`
      <html lang="fr">
        <head>
          <title>Dashboard - ${guild.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background:#0c0a09; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; }
            .content { max-width:750px; width:90%; margin:auto; }
            .card { background:#1c1917; padding:22px; border-radius:12px; margin-bottom:20px; border:1px solid #f97316; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            h3 { margin-top:0; color:#f97316; font-size:18px; border-bottom:1px solid #292524; padding-bottom:8px; }
            label { font-weight:bold; display:block; margin-top:12px; color:#f5f5f4; font-size:14px; }
            input, select { width:100%; padding:12px; border-radius:6px; border:1px solid #44403c; margin-top:6px; background:#0c0a09; color:white; box-sizing:border-box; font-size:14px; }
            input:focus, select:focus { border-color:#f97316; outline:none; }
            .btn-save { background:#f97316; color:white; border:none; padding:14px 20px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; font-size:16px; margin-top:10px; transition:0.2s; }
            .btn-save:hover { background:#ea580c; }
          </style>
        </head>
        <body>
          ${HEADER_HTML}
          <div class="content">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:15px;">
              <h2>⚙️ Configuration : <span style="color:#f97316;">${guild.name}</span></h2>
              <a href="/callback" style="color:#f97316; text-decoration:none; font-weight:bold;">← Retour aux serveurs</a>
            </div>

            <form action="/save-config/${guild.id}" method="POST">
              <!-- SECTION SUPPORT -->
              <div class="card">
                <h3>🛡️ Équipe & Rôles Support</h3>
                <label>ID du rôle Admin / Modérateur Support :</label>
                <input type="text" name="support_role_id" placeholder="Ex: 112233445566778899">
              </div>

              <!-- SECTION TICKETS -->
              <div class="card">
                <h3>🎫 Configuration du Système de Tickets</h3>
                <label>ID de la Catégorie / Salon des Tickets :</label>
                <input type="text" name="ticket_category_id" placeholder="Ex: 998877665544332211">
                
                <label>Message d'accueil automatique lors de l'ouverture d'un Ticket :</label>
                <input type="text" name="ticket_welcome_msg" value="Bonjour ! Expliquez votre demande en détail, un membre du staff de la Centrale va vous répondre sous peu.">
              </div>

              <!-- SECTION WARNS -->
              <div class="card">
                <h3>⚠️ Système de Sanctions & Warns</h3>
                <label>Nombre d'avertissements maximum (Max Warns) :</label>
                <input type="number" name="max_warns" value="3" min="1" max="10">

                <label>Sanction automatique au terme des avertissements :</label>
                <select name="warn_action">
                  <option value="timeout">⏱️ Time-out (Exclusion temporaire)</option>
                  <option value="kick">👢 Kick (Expulsion du serveur)</option>
                  <option value="ban">🔨 Ban (Bannissement définitif)</option>
                </select>
              </div>

              <button type="submit" class="btn-save">💾 Enregistrer les modifications</button>
            </form>
          </div>
          ${FOOTER_HTML}
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors du chargement du Dashboard.");
  }
});

// 4. DOCUMENTATION
app.get('/doc', (req, res) => {
  res.send(`
    <html lang="fr">
      <head>
        <title>LA CENTRALE - Documentation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background:#0c0a09; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; }
          .content { max-width:800px; width:90%; margin:auto; line-height:1.6; }
          .card { background:#1c1917; padding:22px; border-radius:12px; border:1px solid #f97316; margin-bottom:20px; }
          h3 { color:#f97316; margin-top:0; }
        </style>
      </head>
      <body>
        ${HEADER_HTML}
        <div class="content">
          <h2 style="color:#ffffff;">📖 Documentation du Bot <span style="color:#f97316;">LA CENTRALE FR</span></h2>
          
          <div class="card">
            <h3>🛡️ Protection Anti-Dox & Anti-Raid</h3>
            <p>Le bot intègre un algorithme d'analyse continue capable d'identifier les comportements de fuites d'informations privées (dox) ainsi que les raids massifs d'utilisateurs. Tout contenu suspect est supprimé automatiquement et transmis aux modérateurs.</p>
          </div>

          <div class="card">
            <h3>🎫 Gestionnaires de Tickets Support</h3>
            <p>Configurez la catégorie dans laquelle les salon-tickets privés seront créés. Dès qu'un utilisateur ouvre un ticket, le rôle support défini sur le dashboard reçoit une notification dédiée.</p>
          </div>

          <div class="card">
            <h3>⚠️ Avertissements (Warns) & Sanctions</h3>
            <p>Le système enregistre chaque avertissement attribué à un utilisateur (\`!warn\`). Lorsque le plafond défini sur le dashboard est atteint, la sanction prédéfinie (Exclusion, Expulsion ou Bannissement) est appliquée immédiatement sans intervention manuelle.</p>
          </div>

          <a href="/" style="color:#f97316; font-weight:bold; text-decoration:none;">← Retour à l'accueil</a>
        </div>
        ${FOOTER_HTML}
      </body>
    </html>
  `);
});

// 5. CONDITIONS D'UTILISATION (TOS)
app.get('/tos', (req, res) => {
  res.send(`
    <html lang="fr">
      <head>
        <title>LA CENTRALE - Conditions d'Utilisation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background:#0c0a09; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; }
          .content { max-width:800px; width:90%; margin:auto; line-height:1.7; }
          .card { background:#1c1917; padding:25px; border-radius:12px; border:1px solid #f97316; }
          h3 { color:#f97316; }
        </style>
      </head>
      <body>
        ${HEADER_HTML}
        <div class="content">
          <div class="card">
            <h2 style="color:#ffffff; margin-top:0;">📜 Conditions Générales d'Utilisation (ToS)</h2>
            <p style="color:#a8a29e; font-size:13px;">Dernière mise à jour : Juillet 2026</p>
            
            <h3>1. Acceptation des Conditions</h3>
            <p>En invitant ou en utilisant le bot Discord <strong>LA CENTRALE FR SÉCURITÉ</strong> sur votre serveur Discord, ou en accédant à cette plateforme Web de gestion, vous reconnaissez avoir lu, compris et accepté sans réserve l'intégralité des présentes conditions d'utilisation.</p>

            <h3>2. Utilisation Conforme et Règles du Service</h3>
            <p>L'administrateur et les utilisateurs du service s'engagent à ne pas exploiter le bot à des fins illégales, frauduleuses, malveillantes ou visant à perturber le réseau Discord. Il est strictement interdit de tenter de contourner les protections de sécurité du bot, de lancer des attaques par déni de service (DDoS) ou d'abuser des API du service. Tout manquement à cette règle entraînera un bannissement définitif et irrévocable de vos serveurs de notre infrastructure.</p>

            <h3>3. Responsabilité de l'Équipe d'Administration</h3>
            <p>Le service est fourni "tel quel", sans garantie de disponibilité ininterrompue. L'équipe de développement de LA CENTRALE FR SÉCURITÉ ne saurait être tenue pour responsable en cas de perte accidentelle de données, de mauvaise configuration d'un serveur par ses administrateurs, ou d'interruption temporaire de service liée à la maintenance de nos hébergeurs.</p>
          </div>
          <br>
          <a href="/" style="color:#f97316; font-weight:bold; text-decoration:none;">← Retour à l'accueil</a>
        </div>
        ${FOOTER_HTML}
      </body>
    </html>
  `);
});

// 6. POLITIQUE DE CONFIDENTIALITÉ (PRIVACY)
app.get('/privacy', (req, res) => {
  res.send(`
    <html lang="fr">
      <head>
        <title>LA CENTRALE - Politique de Confidentialité</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background:#0c0a09; color:white; font-family:sans-serif; margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; }
          .content { max-width:800px; width:90%; margin:auto; line-height:1.7; }
          .card { background:#1c1917; padding:25px; border-radius:12px; border:1px solid #f97316; }
          h3 { color:#f97316; }
        </style>
      </head>
      <body>
        ${HEADER_HTML}
        <div class="content">
          <div class="card">
            <h2 style="color:#ffffff; margin-top:0;">🔒 Politique de Confidentialité & Protections des Données</h2>
            <p style="color:#a8a29e; font-size:13px;">Dernière mise à jour : Juillet 2026</p>
            
            <h3>1. Collecte Strictement Limitée des Données</h3>
            <p>Afin d'assurer les fonctionnalités du service (modération, tickets et configuration), LA CENTRALE FR SÉCURITÉ enregistre uniquement les informations strictement indispensables : les identifiants numériques (IDs) des serveurs, des salons, des rôles configurés, ainsi que le registre des avertissements délivrés aux membres.</p>

            <h3>2. Protection, Utilisation et Non-Revente</h3>
            <p>Toutes les données recueillies restent strictement confidentielles et réservées au bon fonctionnement des algorithmes de sécurité du bot. Elles ne sont **jamais** vendues, louées, commercialisées ou transmises à des entités tierces.</p>

            <h3>3. Droit de Suppression des Données (RGPD)</h3>
            <p>Conformément aux réglementations relatives à la protection de la vie privée, tout administrateur a la possibilité de demander la suppression 
