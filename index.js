const express = require('express');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      qrcode.generate(update.qr, { small: true });
    }
    if (update.connection === 'open') {
      console.log('✅ WhatsApp conectado');
    }
  });
}

app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone e message são obrigatórios' });
  }

  try {
    const jid = phone + '@s.whatsapp.net';
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true, phone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Engine rodando na porta ${PORT}`);
  startWhatsApp();
});