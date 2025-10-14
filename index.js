import express from "express";
import bodyParser from "body-parser";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";

const { Client, LocalAuth } = pkg;
const app = express();
app.use(bodyParser.json());

let qrCodeImage = null;
let clientReady = false;

// --- Servidor HTTP ARRANCA primero ---
app.get("/", (req, res) => {
  if (qrCodeImage) {
    res.send(`
      <h1>📱 Escanea este código QR con WhatsApp Business</h1>
      <img src="${qrCodeImage}" alt="QR WhatsApp" />
      <p>Si no funciona, recarga la página.</p>
    `);
  } else if (clientReady) {
    res.send("✅ Cliente WhatsApp conectado y listo.");
  } else {
    res.send("⌛ Iniciando cliente... espera unos segundos y recarga.");
  }
});

app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Faltan parámetros: to, message" });
    }

    const chatId = to.replace("+", "") + "@c.us";
    const sent = await client.sendMessage(chatId, message);

    res.json({ status: "ok", to, message, id: sent.id.id });
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`);
});

// --- Cliente WhatsApp ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  },
});

client.on("qr", async (qr) => {
  console.log("📱 Escanea este QR para vincular tu cuenta:");
  qrCodeImage = await qrcode.toDataURL(qr);
  console.log("✅ QR disponible en /");
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
  clientReady = true;
  qrCodeImage = null;
});

client.on("auth_failure", (msg) => {
  console.error("❌ Error de autenticación:", msg);
});

client.initialize();

