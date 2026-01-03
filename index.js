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

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Railway', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      qrCodeData = await QRCode.toDataURL(qr);
      console.log('📸 QR gerado, acesse /qr');
    }

    if (connection === 'open') {
      isConnected = true;
      qrCodeData = null;
      console.log('✅ WhatsApp conectado com sucesso');
    }

    if (connection === 'close') {
      isConnected = false;
      const reason = lastDisconnect?.error?.output?.statusCode;

      console.log('⚠️ Conexão fechada:', reason);

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔄 Tentando reconectar...');
        setTimeout(startWhatsApp, 3000);
      } else {
        console.log('❌ Sessão inválida, delete a pasta auth e gere novo QR');
      }
    }
  });
}

/* ---------- ROTAS ---------- */

// Health check (Railway)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: isConnected ? 'connected' : 'disconnected'
  });
});

// QR via navegador
app.get('/qr', (req, res) => {
  if (qrCodeData) {
    res.send(`
      <html>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh">
          <h2>Escaneie o QR Code</h2>
          <img src="${qrCodeData}" />
        </body>
      </html>
    `);
  } else if (isConnected) {
    res.send('✅ WhatsApp já está conectado');
  } else {
    res.send('⏳ QR ainda não gerado, aguarde...');
  }
});

// Envio de mensagens
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: 'phone e message são obrigatórios'
    });
  }

  if (!sock || !isConnected) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp não conectado'
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

/* ---------- SERVER ---------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  startWhatsApp();
});