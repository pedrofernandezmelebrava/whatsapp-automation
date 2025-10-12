// =============================
// ✅ Servidor WhatsApp Web.js estable para Railway
// =============================

import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

let clientReady = false;

// =============================
// 🤖 Inicializa el cliente
// =============================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
});

client.on("qr", qr => {
  console.log("📲 Escanea este código QR para conectar tu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  clientReady = true;
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
});

client.on("disconnected", reason => {
  clientReady = false;
  console.log("⚠️ Cliente desconectado:", reason);
});

try {
  client.initialize();
} catch (err) {
  console.error("❌ Error inicializando WhatsApp:", err);
}

// =============================
// 📡 Endpoint para enviar mensajes
// =============================
app.post("/send", async (req, res) => {
  if (!clientReady) {
    return res.status(503).json({
      status: "error",
      message: "Cliente WhatsApp no está listo aún. Intenta en unos segundos.",
    });
  }

  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }

    const chatId = to.replace(/[^0-9]/g, "") + "@c.us";
    const sentMsg = await client.sendMessage(chatId, message);
    console.log(`📤 Enviado a ${to}: ${message}`);

    res.json({ status: "ok", to, message, id: sentMsg.id.id });
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🚀 Inicia servidor
// =============================
app.get("/", (req, res) => {
  res.send("✅ Servidor WhatsApp activo en Railway");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

