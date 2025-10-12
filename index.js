import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const app = express();
app.use(bodyParser.json());

// Inicializa el cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

client.on("qr", (qr) => {
  console.log("📱 Escanea este código QR con tu WhatsApp Business App:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente de WhatsApp conectado y listo para enviar mensajes");
});

client.on("message", (msg) => {
  console.log(`💬 Mensaje recibido de ${msg.from}: ${msg.body}`);
});

// === ENDPOINT ROBUSTO PARA ENVIAR MENSAJES ===
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }

    // Verificar que el cliente está listo
    if (!client.info || !client.info.wid) {
      return res.status(503).json({
        error:
          "Cliente de WhatsApp aún no está listo. Espera unos segundos e inténtalo de nuevo.",
      });
    }

    // Normalizar número destino → solo dígitos + sufijo @c.us
    const number = to.replace(/\D/g, "") + "@c.us";
    console.log(`📤 Enviando a ${number}: "${message}"`);

    const sent = await client.sendMessage(number, message);
    console.log("✅ Enviado OK. ID:", sent.id?.id || sent.id);

    return res.json({
      status: "ok",
      to,
      message,
      id: sent.id?.id || sent.id,
    });
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp local escuchando en http://localhost:${PORT}`);
});

// Inicializar cliente
client.initialize();
