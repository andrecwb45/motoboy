import express from 'express'
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'

const app = express()
app.use(express.json())

let sock
let lastQR = null

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  sock = makeWASocket({
    auth: state,
    browser: ['Chrome', 'Linux', 'Desktop'],
    generateHighQualityLinkPreview: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      lastQR = qr
      console.log('📲 QR gerado')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('⚠️ Conexão fechada:', reason)
      if (reason !== DisconnectReason.loggedOut) {
        startWhatsApp()
      }
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado')
      lastQR = null
    }
  })
}

app.get('/pair', async (req, res) => {
  if (!lastQR) {
    return res.send('⏳ QR ainda não gerado, aguarde...')
  }

  const qrImage = await QRCode.toDataURL(lastQR)
  res.send(`
    <html>
      <body style="display:flex;flex-direction:column;align-items:center">
        <h2>Escaneie no WhatsApp Business</h2>
        <img src="${qrImage}" />
      </body>
    </html>
  `)
})

app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  if (!sock) return res.status(500).send('WhatsApp não conectado')

  await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message })
  res.send({ success: true })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('🚀 Servidor HTTP ON')
  startWhatsApp()
})