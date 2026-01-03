// ====== FIX CRYPTO (Node 18+) ======
const { webcrypto } = require('crypto');
global.crypto = webcrypto;

// ====== IMPORTS ======
const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

// ====== APP ======
const app = express();
app.use(express.json());

let sock;

// ====== START WHATSAPP ======
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false // 🚫 NADA DE QR
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('✅ WhatsApp CONECTADO');
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('⚠️ Conexão fechada:', reason);

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔄 Tentando reconectar...');
        startWhatsApp();
      }
    }
  });
}

// ====== ROTA DE PAREAMENTO (CÓDIGO) ======
app.get('/pair', async (req, res) => {
  // 🔥 FORÇA SEM CACHE (CORRIGE 304)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (!sock) {
    return res.status(200).send('⏳ WhatsApp ainda iniciando...');
  }

  try {
    // 👉 SEU NÚMERO (DDD + número, sem +)
    const phoneNumber = '5542991288461';

    const pairingCode = await sock.requestPairingCode(phoneNumber);

    console.log('🔑 Pairing Code:', pairingCode);

    return res.status(200).send(`
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Conectar WhatsApp</title>
        </head>
        <body style="font-family:Arial;text-align:center;margin-top:40px">
          <h2>Código de Pareamento</h2>
          <h1 style="letter-spacing:6px">${pairingCode}</h1>
          <p>
            WhatsApp → Aparelhos conectados → Conectar com código
          </p>
          <small>Recarregue a página se o código expirar</small>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    return res.status(500).send('❌ Erro ao gerar código. Recarregue a página.');
  }
});

// ====== ROTA DE ENVIO (n8n) ======
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: 'phone e message são obrigatórios'
    });
  }

  try {
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
    await sock.sendMessage(jid, { text: message });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 Servidor HTTP ON');
  startWhatsApp();
});