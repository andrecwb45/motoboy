const { webcrypto } = require('crypto');
global.crypto = webcrypto;

const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock;
let pairingCode = null;
let isConnected = false;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Chrome', 'Linux', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      isConnected = true;
      console.log('✅ WHATSAPP CONECTADO');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('❌ Conexão fechada:', code);
    }
  });

  // 🔐 GERA PAIRING CODE
  if (!state.creds.registered) {
    pairingCode = await sock.requestPairingCode('5542991288461');
    console.log('🔑 Pairing Code:', pairingCode);
  }
}

/* ROTAS */

app.get('/', (req, res) => {
  res.send('WhatsApp Engine ON');
});

app.get('/pair', (req, res) => {
  if (isConnected) {
    return res.send('✅ WhatsApp já conectado');
  }
  if (!pairingCode) {
    return res.send('⏳ Pairing code ainda não gerado');
  }
  res.send(`
    <h2>Código de Pareamento</h2>
    <h1>${pairingCode}</h1>
    <p>WhatsApp → Aparelhos conectados → Conectar dispositivo → Código</p>
  `);
});

app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!isConnected) {
    return res.status(503).json({ error: 'WhatsApp não conectado' });
  }

  const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text: message });

  res.json({ success: true });
});

/* SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Servidor ON');
  startWhatsApp();
});