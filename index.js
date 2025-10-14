import express from "express";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";

const { Client, LocalAuth } = pkg;

// --- Inicializamos cliente WhatsApp ---
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

// --- Estado del QR ---
let lastQR = null;
client.on("qr", async (qr) => {
  lastQR = qr;
  console.log("📱 Escanea este QR para vincular tu cuenta:");
});
client.on("ready", () => console.log("✅ Cliente WhatsApp conectado y listo en Railway"));
client.on("auth_failure", msg => console.error("❌ Fallo de autenticación:", msg));
client.on("disconnected", reason => console.warn("⚠️ Cliente desconectado:", reason));
client.initialize().catch(err => console.error("❌ Error al iniciar el cliente:", err));

// --- Servidor Express ---
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Página principal
app.get("/", (req, res) => res.send("✅ Servidor WhatsApp activo en Railway."));

// QR visible desde navegador
app.get("/qr", async (req, res) => {
  if (lastQR) {
    const qrImage = await qrcode.toDataURL(lastQR);
    res.send(`<img src="${qrImage}" style="width:300px;height:300px;" />`);
  } else {
    res.send("Esperando QR...");
  }
});

// --- NUEVO /send con validación y formato correcto ---
app.post("/send", async (req, res) => {
  let { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Faltan parámetros: to, message" });
  }

  try {
    // Limpia número: elimina espacios y signos, y asegúrate que tenga @c.us
    to = to.replace(/\D/g, "");
    if (!to.endsWith("@c.us")) to = `${to}@c.us`;

    // Verifica que el cliente esté listo
    if (!client.info || !client.info.wid) {
      console.warn("⚠️ Cliente aún no está listo para enviar mensajes.");
      return res.status(503).json({ error: "Cliente WhatsApp aún no listo" });
    }

    console.log(`📩 Enviando mensaje a ${to}: ${message}`);

    const result = await client.sendMessage(to, message);

    console.log(`✅ Mensaje enviado correctamente a ${to}`);
    res.json({
      status: "ok",
      to,
      message,
      id: result.id.id,
    });
  } catch (err) {
    console.error("❌ Error enviando mensaje:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});
