import express from "express";
import bodyParser from "body-parser";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

let lastQR = null; // guardará el último QR generado

// --- Configuración de WhatsApp-Web.js ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  },
});

client.on("qr", async (qr) => {
  console.log("📱 Escanea este QR para vincular tu cuenta:");
  lastQR = qr;
});

client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
});

client.initialize().catch(err => {
  console.error("❌ Error al iniciar el cliente:", err);
});

// --- Rutas Express ---

app.get("/", (req, res) => {
  res.send("✅ Servidor WhatsApp activo en Railway. Visita /qr para escanear el código QR.");
});

// 📸 Muestra el QR actual como imagen PNG
app.get("/qr", async (req, res) => {
  if (!lastQR) {
    return res.status(404).send("⏳ Aún no hay QR disponible. Espera unos segundos...");
  }

  try {
    const qrImage = await qrcode.toDataURL(lastQR);
    const html = `
      <html>
        <head><title>QR de WhatsApp</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;font-family:sans-serif;">
          <h2>📱 Escanea este código QR con tu app de WhatsApp Business</h2>
          <img src="${qrImage}" />
        </body>
      </html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send("Error generando el QR: " + err.message);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

