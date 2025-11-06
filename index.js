import express from "express";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";

const { Client, LocalAuth } = pkg;

// --- Inicializamos cliente WhatsApp ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: "/usr/bin/chromium",
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
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2410.1.html",
  },
});

// --- Estado del QR ---
let lastQR = null;

client.on("qr", async (qr) => {
  lastQR = qr;
  console.log("📱 Escanea este QR para vincular tu cuenta:");
});

client.on("ready", () =>
  console.log("✅ Cliente WhatsApp conectado y listo en Railway")
);
client.on("auth_failure", (msg) => console.error("❌ Fallo de autenticación:", msg));
client.on("disconnected", (reason) => console.warn("⚠️ Cliente desconectado:", reason));

client.initialize().catch((err) =>
  console.error("❌ Error al iniciar el cliente:", err)
);

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

// --- NUEVO ENDPOINT: Buscar grupo por nombre ---
app.post("/sync-group", async (req, res) => {
  const { groupName } = req.body;

  if (!groupName || typeof groupName !== "string") {
    return res.status(400).json({ error: "Falta el parámetro groupName (texto)" });
  }

  try {
    if (!client.info || !client.info.wid) {
      return res.status(503).json({ error: "Cliente WhatsApp aún no listo" });
    }

    console.log(`🔍 Buscando grupo con nombre exacto: "${groupName}"`);
    const chats = await client.getChats();
    const groups = chats.filter((c) => c.isGroup);
    const match = groups.find(
      (g) => g.name.trim().toLowerCase() === groupName.trim().toLowerCase()
    );

    if (match) {
      console.log(`✅ Grupo encontrado: ${match.name} → ${match.id._serialized}`);
      return res.json({
        status: "ok",
        id: match.id._serialized,
        name: match.name,
      });
    } else {
      console.log("⚠️ No se encontró ningún grupo con ese nombre.");
      return res.status(404).json({ error: "Grupo no encontrado" });
    }
  } catch (err) {
    console.error("❌ Error buscando grupo:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Util: normalizar números a WIDs ---
function toWid(idLike) {
  // ya viene como @c.us o @g.us -> lo dejamos tal cual
  if (/@(c|g)\.us$/i.test(idLike)) return idLike.trim();
  // E.164 +XXXXXXXX -> convertimos a 34...@c.us
  const clean = String(idLike || "").trim();
  const e164 = /^\+[1-9]\d{6,14}$/;
  if (!e164.test(clean)) {
    throw new Error(`Número inválido (usa E.164): ${idLike}`);
  }
  return `${clean.slice(1)}@c.us`;
}

// --- Endpoint: crear grupo ---
app.post("/create-group", async (req, res) => {
  try {
    const { groupTitle, participants, initialMessage } = req.body || {};

    if (!groupTitle || typeof groupTitle !== "string" || !groupTitle.trim()) {
      return res.status(400).json({ error: "Falta groupTitle" });
    }
    if (!Array.isArray(participants) || participants.length < 2) {
      return res.status(400).json({ error: "Se requieren al menos 2 participantes" });
    }

    // Cliente listo
    if (!client || !client.info || !client.info.wid) {
      return res.status(503).json({ error: "Cliente WhatsApp aún no listo" });
    }

    // Normalizar participantes a WID de WhatsApp
    let wids;
    try {
      wids = participants.map(toWid);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    console.log("🧪 Solicitud de creación de grupo:");
    console.log("   • Título:", groupTitle);
    console.log("   • Participantes:", wids.join(", "));

    // Crear grupo
    const chat = await client.createGroup(groupTitle.trim(), wids);

    // Algunas versiones devuelven obj distinto; cubrimos ambos casos
    const groupId =
      (chat && chat.gid && chat.gid._serialized) ||
      (chat && chat.id && chat.id._serialized) ||
      (chat && chat.id && chat.id.id) ||
      null;

    const groupName = (chat && (chat.subject || chat.name)) || groupTitle.trim();

    console.log(`✅ Grupo creado: ${groupName} → ${groupId}`);

    // Mensaje inicial opcional
    if (initialMessage && groupId) {
      try {
        await client.sendMessage(groupId, String(initialMessage));
        console.log("✉️ Mensaje inicial enviado al grupo");
      } catch (e) {
        console.warn("⚠️ No se pudo enviar el mensaje inicial:", e.message);
      }
    }

    return res.json({
      status: "ok",
      id: groupId,
      name: groupName,
      participants: wids,
    });
  } catch (err) {
    console.error("❌ Error en /create-group:", err);
    return res.status(500).json({ error: err.message || "Error creando grupo" });
  }
});



app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor WhatsApp escuchando en puerto ${PORT}`);
});

