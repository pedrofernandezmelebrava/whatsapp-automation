// =========================================
// 🚀 WhatsApp Automation - Railway Stable Build
// =========================================
import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

let clientReady = false;

// =========================================
// 🤖 WhatsApp Client
// =========================================
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
  console.log("📲 Escanea este código QR:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  clientReady = true;
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
});

client.on("disconnected", reason => {
  clientReady = false;
  console.log("⚠️ Cliente desconectado:", reason);
  // Reiniciar automáticamente si se cae
  client.initialize();
});

// Inicializa sin bloquear Express
(async () => {
  try {
    await client.initialize();
  } catch (err) {
    console.error("❌ Error al iniciar el cliente:", err);
  }
})();

// =========================================
// 🌐 Endpoint principal (para health check)
// =========================================
app.get("/", (req, res) => {
  res.status(200).send("✅ Servidor WhatsApp activo en Railway");
});

// =========================================
// 📩 Endpoint de envío de mensajes
// =========================================
app.post("/send", async (req, res) => {
  try {
    if (!clientReady)
      return res.status(503).json({ error: "Cliente WhatsApp no está listo" });

    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ error: "Faltan parámetros: to, message" });

    const chatId = to.replace(/[^0-9]/g, "") + "@c.us";
    const sent = await client.sendMessage(chatId, message);

    console.log(`📤 Enviado a ${to}: ${message}`);
    return res.json({ status: "ok", id: sent.id.id, to, message });
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =========================================
// 🚀 Inicia servidor Express
// =========================================
app.listen(PORT, () =>
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`)
);
