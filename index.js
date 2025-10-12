// =============================
// 🚀 Servidor WhatsApp en Railway (versión estable)
// =============================
import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import fetch from "node-fetch";
const { Client, LocalAuth } = pkg;

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

let clientReady = false;

// =============================
// 🤖 Cliente WhatsApp
// =============================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/google-chrome-stable", // <- usa el Chrome de Railway
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

// Inicializamos sin bloquear Express
client.initialize().catch(err =>
  console.error("❌ Error inicializando WhatsApp:", err)
);

// =============================
// 📡 Endpoint de envío
// =============================
app.post("/send", async (req, res) => {
  try {
    if (!clientReady)
      return res
        .status(503)
        .json({ status: "error", message: "Cliente no está listo" });

    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ error: "Faltan parámetros: to, message" });

    const chatId = to.replace(/[^0-9]/g, "") + "@c.us";
    const msg = await client.sendMessage(chatId, message);
    console.log(`📤 Mensaje enviado a ${to}: ${message}`);

    res.json({ status: "ok", id: msg.id.id, to, message });
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🌐 Ruta principal (Railway health check)
// =============================
app.get("/", (req, res) => {
  res.status(200).send("✅ Servidor WhatsApp activo y respondiendo correctamente");
});

// =============================
// 🔁 Auto-ping para mantener activo
// =============================
setInterval(() => {
  const selfUrl = `https://whatsapp-automation-production-afb3.up.railway.app/`;
  fetch(selfUrl)
    .then(() => console.log("🔁 Auto-ping enviado"))
    .catch(() => {});
}, 4 * 60 * 1000);

// =============================
// 🚀 Inicia servidor
// =============================
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});
