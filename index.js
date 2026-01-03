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

let sock;
let qrCodeData = null;
let isConnected = false;
let isStarting = false;

async function startWhatsApp() {
  if (isStarting) return;
  isStarting = true;

  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Chrome', 'Linux', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      qrCodeData = await QRCode.toDataURL(qr);
      console.log('📸 QR GERADO → /qr');
    }

    if (connection === 'open') {
      isConnected = true;
      qrCodeData = null;
      console.log('✅ WHATSAPP CONECTADO');
    }

    if (connection === 'close') {
      isConnected = false;
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Conexão fechada:', reason);

      // 🚫 NÃO reconecta automaticamente
      console.log('⛔ Aguardando novo deploy para reconectar');
    }
  });
}

/* -------- ROTAS -------- */

app.get('/', (req, res) => {
  res.send('WhatsApp Engine ON');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: isConnected ? 'connected' : 'disconnected'
  });
});

app.get('/qr', (req, res) => {
  if (qrCodeData) {
    res.send(`
      <html>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh">
          <img src="${qrCodeData}" />
        </body>
      </html>
    `);
  } else if (isConnected) {
    res.send('✅ WhatsApp já conectado');
  } else {
    res.send('⏳ QR ainda não gerado');
  }
});

app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone e message obrigatórios' });
  }

  if (!sock || !isConnected) {
    return res.status(503).json({ error: 'WhatsApp não conectado' });
  }

  try {
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------- SERVER -------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Servidor HTTP ON');
  startWhatsApp();
});