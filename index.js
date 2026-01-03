/**
 * FIXES APLICADOS:
 * - crypto definido corretamente (Node 18+)
 * - CommonJS puro (sem misturar import/require)
 * - QR não impresso no terminal
 * - Processo não morre enquanto espera QR
 * - Endpoint /qr para escanear no Railway
 * - Auto-reconnect defensivo
 */

const { webcrypto } = require('crypto');
global.crypto = webcrypto;

const express = require('express');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock = null;
let lastQR = null;

/* =========================
   START WHATSAPP
========================= */
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '22.04']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      lastQR = qr;
      console.log('📲 QR gerado — disponível em /qr');
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso');
      lastQR = null;
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('⚠️ Conexão fechada. Reconnect:', shouldReconnect);

      if (shouldReconnect) {
        setTimeout(startWhatsApp, 5000);
      }
    }
  });
}

/* =========================
   ENDPOINT QR
========================= */
app.get('/qr', async (req, res) => {
  if (!lastQR) {
    return res.status(404).json({
      success: false,
      message: 'QR não disponível. WhatsApp já conectado ou aguardando.'
    });
  }

  const qrImage = await QRCode.toDataURL(lastQR);
  res.send(`
    <html>
      <body style="display:flex;align-items:center;justify-content:center;height:100vh">
        <img src="${qrImage}" />
      </body>
    </html>
  `);
});

/* =========================
   SEND MESSAGE
========================= */
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: 'phone e message são obrigatórios'
    });
  }

  if (!sock) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp ainda não conectado'
    });
  }

  try {
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
    await sock.sendMessage(jid, { text: message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Engine rodando na porta ${PORT}`);
  startWhatsApp();
});