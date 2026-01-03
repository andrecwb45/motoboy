const { webcrypto } = require('crypto');
global.crypto = webcrypto;

const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock;
let lastQR = null;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      lastQR = update.qr;
      console.log('📲 QR atualizado');
    }

    if (update.connection === 'open') {
      console.log('✅ WhatsApp conectado');
      lastQR = null;
    }
  });
}

// 🔥 ENDPOINT DO QR (ESSENCIAL)
app.get('/qr', (req, res) => {
  if (!lastQR) {
    return res.status(404).send('QR não disponível ou já conectado');
  }

  res.send(`
    <html>
      <body style="display:flex;align-items:center;justify-content:center;height:100vh;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}" />
      </body>
    </html>
  `);
});

// 📤 ENVIO DE MENSAGEM
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: 'phone e message são obrigatórios'
    });
  }

  try {
    const jid = phone + '@s.whatsapp.net';
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Engine rodando na porta ${PORT}`);
  startWhatsApp();
});