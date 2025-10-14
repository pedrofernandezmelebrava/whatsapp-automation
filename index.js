import express from "express";
import bodyParser from "body-parser";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";

const { Client, LocalAuth } = pkg;
const app = express();
app.use(bodyParser.json());

let qrCodeImage = null;

// Inicializar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true
  }
});

// Evento QR → genera imagen accesible por web
client.on("qr", async (qr) => {
  console.log("📱 Escanea este QR para vincular tu cuenta:");
  try {
    qrCodeImage = await qrcode.toDataURL(qr);
    console.log("✅ QR generado y disponible en / (abre tu URL en el navegador)");
  } catch (err) {
    console.error("❌ Error generando imagen del QR:", err);
  }
});

// Cuando el cliente se conecta
client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
  qrCodeImage = null; // QR ya no es necesario
});

// Endpoint raíz → muestra QR si está disponible
app.get("/", (req, res) => {
  if (qrCodeImage) {
    res.send(`
      <h1>Escanea este código QR con WhatsApp Business</h1>
      <img src="${qrCodeImage}" alt="QR WhatsApp" />
    `);
  } else {
    res.send("✅ Cliente conectado o QR no disponible todavía.");
  }
});

// Endpoint para enviar mensaje
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ error: "Faltan parámetros: to, message" });

    const chatId = to.replace("+", "") + "@c.us";
    const sentMessage = await client.sendMessage(chatId, message);

    res.json({
      status: "ok",
      to,
      message,
      id: sentMessage.id.id
    });
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

client.initialize();
