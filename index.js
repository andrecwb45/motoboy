const { webcrypto } = require('crypto')
global.crypto = webcrypto

const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const app = express()
app.use(express.json())

let sock
let qrCode = null
let started = false

async function startWhatsApp() {
  if (started) return
  started = true

  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Chrome', 'Linux', 'Railway']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrCode = qr
      console.log('📲 QR GERADO — acesse /pair')
    }

    if (connection === 'open') {
      qrCode = null
      console.log('✅ WhatsApp conectado DEFINITIVAMENTE')
    }

    if (connection === 'close') {
      const reason =
        lastDisconnect?.error?.output?.statusCode

      console.log('❌ Conexão fechada:', reason)

      if (reason !== DisconnectReason.loggedOut) {
        started = false
      }
    }
  })
}

/* 🔑 ROTA DE PAREAMENTO */
app.get('/pair', async (req, res) => {
  await startWhatsApp()

  if (!qrCode) {
    return res.send('⌛ QR ainda não gerado, aguarde...')
  }

  res.send(`
    <html>
      <body style="text-align:center">
        <h2>Escaneie este QR no WhatsApp</h2>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrCode}" />
      </body>
    </html>
  `)
})

/* 🚀 ENVIO DE MENSAGEM */
app.post('/send', async (req, res) => {
  const { phone, message } = req.body

  if (!sock) {
    return res.status(500).json({ error: 'WhatsApp não conectado' })
  }

  await sock.sendMessage(phone + '@s.whatsapp.net', { text: message })
  res.json({ success: true })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('🚀 Servidor HTTP ON')
})