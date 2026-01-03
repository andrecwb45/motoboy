// ====== PATCH CRYPTO (OBRIGATÓRIO NO RAILWAY) ======
const { webcrypto } = require('crypto')
global.crypto = webcrypto

// ====== DEPENDÊNCIAS ======
const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

// ====== APP ======
const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000

// ====== ESTADO GLOBAL ======
let sock = null
let qrCode = null
let isStarting = false

// ====== START WHATSAPP ======
async function startWhatsApp() {
  if (sock || isStarting) return
  isStarting = true

  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      qrCode = qr
      console.log('📸 QR atualizado')
    }

    if (connection === 'open') {
      qrCode = null
      console.log('✅ WhatsApp conectado DEFINITIVAMENTE')
    }

    if (connection === 'close') {
      const reason =
        lastDisconnect?.error?.output?.statusCode

      console.log('❌ Conexão fechada:', reason)

      sock = null
      qrCode = null
      isStarting = false

      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(startWhatsApp, 3000)
      }
    }
  })
}

// ====== ROTA PRINCIPAL ======
app.get('/', (req, res) => {
  res.send('🚀 WhatsApp Engine ON')
})

// ====== ROTA /pair (ANTI-CACHE TOTAL) ======
app.get('/pair', async (req, res) => {
  // 🚫 DESATIVAR CACHE (ESSENCIAL PARA NÃO DAR 304)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')

  await startWhatsApp()

  if (!qrCode) {
    return res.status(200).send(`
      <html>
        <head>
          <meta http-equiv="cache-control" content="no-cache" />
          <meta http-equiv="pragma" content="no-cache" />
          <meta http-equiv="expires" content="0" />
        </head>
        <body style="font-family:sans-serif;text-align:center;padding-top:50px">
          <h2>⌛ QR ainda não gerado</h2>
          <p>Aguarde alguns segundos e atualize esta página.</p>
        </body>
      </html>
    `)
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="cache-control" content="no-cache" />
        <meta http-equiv="pragma" content="no-cache" />
        <meta http-equiv="expires" content="0" />
        <title>WhatsApp Pair</title>
      </head>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
        <h2>Escaneie o QR Code</h2>
        <img src="${qrUrl}" />
        <p>Não feche esta página até conectar.</p>
      </body>
    </html>
  `)
})

// ====== ROTA DE ENVIO ======
app.post('/send', async (req, res) => {
  const { phone, message } = req.body

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: 'phone e message são obrigatórios'
    })
  }

  if (!sock) {
    return res.status(500).json({
      success: false,
      error: 'WhatsApp não conectado'
    })
  }

  try {
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net'
    await sock.sendMessage(jid, { text: message })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    })
  }
})

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP ON na porta ${PORT}`)
})