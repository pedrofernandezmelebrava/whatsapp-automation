import express from "express";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";

const { Client, LocalAuth } = pkg;

// --- Inicializamos cliente WhatsApp ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: '/usr/bin/chromium', // Si falla, cambiar a '/usr/bin/google-chrome-stable'
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--disable-software-rasterizer",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--single-process"
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

// 🔐 Middleware simple de autenticación por clave
app.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Acceso no autorizado: clave API inválida" });
  }
  next();
});

// --- Endpoint principal de envío ---
app.post("/send", async (req, res) => {
  let { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Faltan parámetros: to, message" });
  }

  try {
    // 🧩 Normalización correcta del número o ID de grupo
    // Si ya es un ID válido, no tocarlo
    if (!/@(c|g)\.us$/.test(to)) {
      // Elimina solo espacios y guiones, pero conserva el "+"
      let clean = to.replace(/[\s\-]/g, "");

      // ✅ Si comienza con "+", conserva el prefijo internacional (no lo borra)
      if (clean.startsWith("+")) {
        // Elimina solo el "+" antes de agregar el dominio
        clean = clean.substring(1);
      }

      // Si no tiene prefijo + ni dominio, asume prefijo 34 (España)
      if (!clean.startsWith("34")) {
        console.warn(`⚠️ Número sin prefijo internacional detectado (${clean}), se añade +34`);
        clean = "34" + clean;
      }

      to = `${clean}@c.us`;
    }

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

