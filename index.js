import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

// Inicia cliente de WhatsApp con autenticación local
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ],
    headless: true,
  },
});

let isReady = false;

client.on("qr", (qr) => {
  console.log("📱 Escanea este QR para vincular tu cuenta:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
  isReady = true;
});

client.on("message", (msg) => {
  console.log(`💬 Mensaje recibido de ${msg.from}: ${msg.body}`);
});

client.initialize();

// Endpoint raíz
app.get("/", (req, res) => {
  res.status(200).send("✅ Servidor WhatsApp Web.js en Railway funcionando correctamente.");
});

// Endpoint para enviar mensajes
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }

    if (!isReady) {
      return res.status(503).json({ error: "Cliente de WhatsApp no está listo aún." });
    }

    const chatId = to.replace("+", "") + "@c.us";
    await client.sendMessage(chatId, message);

    console.log(`📤 Mensaje enviado a ${chatId}: ${message}`);
    res.json({ success: true, to, message });
  } catch (error) {
    console.error("❌ Error en /send:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

