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
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode";

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--single-process",
      "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ],
    headless: true,
  },
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2410.1.html",
  },
});

// --- Generación de QR ---
let lastQR = null;
client.on("qr", async (qr) => {
  lastQR = qr;
  console.log("📱 Escanea este QR para vincular tu cuenta:");
});

// --- Conexión exitosa ---
client.on("ready", () => {
  console.log("✅ Cliente WhatsApp conectado y listo en Railway");
});

// --- Errores ---
client.on("auth_failure", msg => console.error("❌ Fallo de autenticación:", msg));
client.on("disconnected", reason => console.warn("⚠️ Cliente desconectado:", reason));

// --- Inicializar cliente ---
client.initialize().catch(err => {
  console.error("❌ Error al iniciar el cliente:", err);
});

// --- Endpoint para mostrar el QR ---
import express from "express";
const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => res.send("✅ Servidor WhatsApp activo."));
app.get("/qr", async (req, res) => {
  if (lastQR) {
    const qrImage = await qrcode.toDataURL(lastQR);
    res.send(`<img src="${qrImage}" style="width:300px;height:300px;" />`);
  } else {
    res.send("Esperando QR...");
  }
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
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

