// index.js
import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

// 🧠 Inicializar cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(), // guarda la sesión en .wwebjs_auth
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ],
  },
});

let qrCodeImage = null;
let ready = false;

// 📲 Cuando se genera un QR
client.on("qr", async (qr) => {
  console.log("📱 Escanea este QR para vincular tu cuenta:");
  qrCodeImage = await qrcode.toDataURL(qr);
});

// ✅ Cuando el cliente está listo
client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
  ready = true;
});

// 📩 Mensajes recibidos (opcional)
client.on("message", (msg) => {
  console.log(`💬 Mensaje recibido de ${msg.from}: ${msg.body}`);
});

// 🧠 Inicializamos el cliente
client.initialize().catch(err => {
  console.error("❌ Error al iniciar el cliente:", err);
});

// 🛠️ Endpoint raíz
app.get("/", (req, res) => {
  res.send("✅ Servidor WhatsApp activo y funcionando en Railway.");
});

// 🧠 Endpoint para healthcheck
app.get("/ping", (req, res) => {
  res.json({ status: "alive", ready });
});

// 🖼️ Endpoint para mostrar QR si aún no está autenticado
app.get("/qr", (req, res) => {
  if (!qrCodeImage) {
    return res.send("⏳ Esperando generación del QR...");
  }
  res.send(`<h2>Escanea este código QR con WhatsApp</h2><br><img src="${qrCodeImage}" />`);
});

// 🚀 Endpoint para enviar mensajes desde Apps Script
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }

    if (!ready) {
      return res.status(503).json({ error: "Cliente WhatsApp no está listo todavía" });
    }

    const chatId = to.replace("+", "") + "@c.us";
    const msg = await client.sendMessage(chatId, message);

    console.log(`📤 Mensaje enviado a ${to}: ${message}`);
    res.json({ status: "ok", to, message, id: msg.id.id });
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

