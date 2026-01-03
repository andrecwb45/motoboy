const { webcrypto } = require('crypto');
global.crypto = webcrypto;

const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState
} = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock;
let isReady = false;
let pairingCode = null;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Chrome', 'Linux', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;

    if (connection === 'open') {
      isReady = true;
      console.log('✅ WhatsApp socket pronto');
    }

    if (connection === 'close') {
      isReady = false;
      console.log('⚠️ Conexão fechada, aguardando reconexão');
    }
  });
}

/* ROTAS */

app.get('/', (req, res) => {
  res.send('WhatsApp Engine ON');
});

app.get('/pair', async (req, res) => {
  if (!sock) {
    return res.send('⏳ Socket ainda iniciando');
  }

  if (!isReady) {
    return res.send('⏳ WhatsApp ainda conectando, aguarde 10s e recarregue');
  }

  if (!pairingCode) {
    pairingCode = await sock.requestPairingCode('55SEUNUMEROAQUI');
    console.log('🔑 Pairing Code:', pairingCode);
  }

  res.send(`
    <h1>${pairingCode}</h1>
    <p>WhatsApp → Aparelhos conectados → Conectar com código</p>
  `);
});

app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!isReady) {
    return res.status(503).json({ error: 'WhatsApp não conectado' });
  }

  const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text: message });

  res.json({ success: true });
});

/* SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Servidor HTTP ON');
  startWhatsApp();
});