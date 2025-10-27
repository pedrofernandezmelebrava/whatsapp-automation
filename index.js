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

// 🔐 Middleware de autenticación por API key
app.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Acceso no autorizado: clave API inválida" });
  }
  next();
});

// --- Endpoint principal /send ---
app.post("/send", async (req, res) => {
  let { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Faltan parámetros: to, message" });
  }

  try {
    // 🧩 Normalización estricta
    if (!/@(c|g)\.us$/i.test(to)) {
      const clean = String(to).trim();
      const e164 = /^\+[1-9]\d{6,14}$/;
      if (!e164.test(clean)) {
        return res.status(400).json({
          error: "Formato de número inválido. Usa formato E.164, por ejemplo: +34695706336",
        });
      }
      to = `${clean.slice(1)}@c.us`;
    }

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

// --- NUEVO: Endpoint /sync-group para guardar ID del grupo en Sheets ---
app.post("/sync-group", async (req, res) => {
  const { property, groupName } = req.body;
  if (!property || !groupName) {
    return res.status(400).json({ error: "Faltan parámetros: property, groupName" });
  }

  try {
    if (!client || !client.info || !client.info.wid) {
      return res.status(503).json({ error: "Cliente WhatsApp aún no listo" });
    }

    console.log(`🔍 Buscando grupo: ${groupName}`);
    const chats = await client.getChats();
    const group = chats.find(c => c.isGroup && c.name.trim() === groupName.trim());

    if (!group) {
      return res.status(404).json({ error: `Grupo no encontrado: ${groupName}` });
    }

    const groupId = group.id._serialized;
    console.log(`✅ Grupo encontrado: ${groupName} → ${groupId}`);

    // === Llamada al Apps Script ===
    const webAppUrl = "https://script.google.com/macros/s/AKfycbymossFhCG3A2tSkGE8Vxz4HZjoIX9q86ruf0WIHsLPOkHKQvIpex24tf0zx2zUwpbSbA/exec";
    const token = process.env.GROUP_SAVE_TOKEN; // define esta variable en Railway
    const params = new URLSearchParams({
      action: "saveGroupId",
      token,
      property,
      groupName,
      groupId
    });

    const response = await fetch(`${webAppUrl}?${params.toString()}`);
    const data = await response.json();

    if (!data.ok) {
      console.error("❌ Error guardando en Sheets:", data.error);
      return res.status(500).json({ error: data.error });
    }

    console.log(`💾 Guardado correctamente en hoja de ${property} (fila ${data.row})`);
    res.json({ status: "ok", property, groupName, groupId });

  } catch (err) {
    console.error("❌ Error en /sync-group:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

