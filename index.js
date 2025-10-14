import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;
let isReady = false;

// --- Inicializa el cliente de WhatsApp ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
    ],
  },
});

client.on("qr", (qr) => {
  console.log("📱 Escanea este QR para vincular tu cuenta:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo");
  isReady = true;
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Cliente desconectado:", reason);
  isReady = false;
  client.initialize();
});

client.on("message", (msg) => {
  console.log(`💬 Mensaje recibido de ${msg.from}: ${msg.body}`);
});

client.initialize().catch((err) => {
  console.error("❌ Error al iniciar el cliente:", err);
});

// --- Rutas HTTP ---
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "Servidor WhatsApp activo 🚀" });
});

app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }

    if (!isReady) {
      return res.status(503).json({ error: "El cliente de WhatsApp no está listo aún." });
    }

    const chatId = to.replace("+", "") + "@c.us";
    await client.sendMessage(chatId, message);
    console.log(`📤 Mensaje enviado a ${chatId}: ${message}`);
    res.json({ status: "ok", to, message });
  } catch (err) {
    console.error("❌ Error en /send:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Evita que Railway mate el proceso por inactividad ---
app.get("/keepalive", (req, res) => {
  res.send("✅ Keep-alive OK");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});
