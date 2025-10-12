// =============================
// ✅ Servidor WhatsApp Web.js para Railway
// =============================

import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

// =============================
// 🔧 Configuración de Express
// =============================
const app = express();
const PORT = process.env.PORT || 3000;

// Permitir JSON y formularios
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// =============================
// 🤖 Configuración del cliente WhatsApp
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

// =============================
// 🔐 Eventos de conexión
// =============================
client.on("qr", qr => {
  console.log("📲 Escanea este código QR para conectar tu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
});

client.on("message", msg => {
  console.log(`💬 Mensaje recibido de ${msg.from}: ${msg.body}`);
});

// Inicializa el cliente
client.initialize();

// =============================
// 📡 Endpoint para envío de mensajes
// =============================
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      console.warn("⚠️ Faltan parámetros en la solicitud:", req.body);
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }

    const chatId = to.replace(/[^0-9]/g, "") + "@c.us";
    const sentMsg = await client.sendMessage(chatId, message);

    console.log(`📤 Mensaje enviado correctamente a ${to}: "${message}"`);
    res.json({
      status: "ok",
      to,
      message,
      id: sentMsg.id.id
    });

  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🚀 Inicia el servidor
// =============================
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

