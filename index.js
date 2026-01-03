const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const app = express()
app.use(express.json())

// evita cache 304 no Railway
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

let sock
let isConnecting = false

async function startWhatsApp() {
  if (sock || isConnecting) return
  isConnecting = true

  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('⚠️ Conexão fechada:', reason)

      sock = null
      isConnecting = false

      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(startWhatsApp, 3000)
      }
    }
  })

  isConnecting = false
}

// ===== ROTA DE PAREAMENTO POR CÓDIGO (OFICIAL) =====
app.get('/pair-code', async (req, res) => {
  await startWhatsApp()

  if (!sock) {
    return res.send('Inicializando WhatsApp, atualize em alguns segundos.')
  }

  try {
    // 🔴 TROQUE PARA SEU NÚMERO
    const phoneNumber = '55DDDNÚMERO' // ex: 5511999999999

    const code = await sock.requestPairingCode(phoneNumber)

    res.send(`
      <html>
        <body style="font-family:sans-serif;text-align:center;padding-top:50px">
          <h2>Código de pareamento</h2>
          <h1 style="letter-spacing:6px">${code}</h1>
          <p>
            WhatsApp → Dispositivos conectados →  
            Conectar com número de telefone
          </p>
        </body>
      </html>
    `)
  } catch (err) {
    res.send('Erro ao gerar código: ' + err.message)
  }
})

// ===== ENVIO DE MENSAGEM (n8n / Mocha) =====
app.post('/send', async (req, res) => {
  const { phone, message } = req.body

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: 'phone e message são obrigatórios'
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

// ===== HEALTHCHECK =====
app.get('/', (_, res) => {
  res.send('WhatsApp Engine ON')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('🚀 Servidor ON na porta', PORT)
  startWhatsApp()
})