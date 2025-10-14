import express from "express";
import bodyParser from "body-parser";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";

const { Client, LocalAuth } = pkg;
const app = express();
app.use(bodyParser.json());

let qrCodeImage = null;
let clientReady = false;

// === ENDPOINTS HTTP SIEMPRE DISPONIBLES ===
app.get("/", (req, res) => {
  res.set("Content-Type", "text/html");
  if (qrCodeImage) {
    res.send(`
      <h2>📱 Escanea este código QR con WhatsApp Business</h2>
      <img src="${qrCodeImage}" style="width:300px;height:300px;" />
      <p>Actualiza la página si el QR expira.</p>
    `);
  } else if (clientReady) {
    res.send("<h2>✅ Cliente WhatsApp conectado y listo.</h2>");
  } else {
    res.send("<h2>⌛ Iniciando cliente de WhatsApp... espera unos segundos.</h2>");
  }
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }
    const chatId = to.replace("+", "") + "@c.us";
    const sent = await client.sendMessage(chatId, message);
    res.json({ status: "ok", id: sent.id.id });
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    res.status(500).json({ error: err.message });
  }
});

// === INICIA EXPRESS PRIMERO ===
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`);
});

// === INICIA WHATSAPP ===
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

client.on("qr", async (qr) => {
  try {
    qrCodeImage = await qrcode.toDataURL(qr);
    console.log("📱 Escanea el QR disponible en /");
  } catch (err) {
    console.error("❌ Error generando QR:", err);
  }
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo.");
  clientReady = true;
  qrCodeImage = null;
});

client.on("auth_failure", (msg) => {
  console.error("❌ Fallo de autenticación:", msg);
});

client.initialize();

