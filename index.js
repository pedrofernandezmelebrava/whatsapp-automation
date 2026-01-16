import express from "express";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode";
import fs from "fs/promises";

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
      // NOTA: evitamos "--single-process" por inestabilidades en algunos entornos
    ],
    headless: true,
  },
  // NOTA: NO fijamos webVersionCache para evitar roturas por versión obsoleta
});

// --- Estado global ---
let lastQR = null;
let isReady = false;
let lastState = "init";
let lastDisconnectReason = null;
let lastAuthFailure = null;

// --- Logs clave ---
client.on("qr", async (qr) => {
  lastQR = qr;
  isReady = false;
  console.log("🧩 QR GENERATED - Abre /qr para escanear.");
});

client.on("authenticated", () => {
  console.log("🔐 AUTHENTICATED - QR aceptado.");
  lastAuthFailure = null;
});

client.on("ready", () => {
  isReady = true;
  lastState = "ready";
  console.log("✅ READY - Cliente WhatsApp conectado y listo.");
});

client.on("change_state", (state) => {
  lastState = state;
  console.log("🔄 STATE:", state);
});

client.on("auth_failure", (msg) => {
  lastAuthFailure = String(msg || "");
  isReady = false;
  console.error("❌ AUTH FAILURE:", msg);
});

client.on("disconnected", (reason) => {
  lastDisconnectReason = String(reason || "");
  isReady = false;
  console.warn("⚠️ DISCONNECTED:", reason);
});

// Inicialización
client.initialize().catch((err) =>
  console.error("❌ Error al iniciar el cliente:", err)
);

// --- Servidor Express ---
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Público: salud
app.get("/", (req, res) => res.send("✅ Servidor WhatsApp activo en Railway."));

// Público: estado (útil para depurar)
app.get("/status", (req, res) => {
  res.json({
    ready: isReady,
    state: lastState,
    hasQR: Boolean(lastQR),
    lastDisconnectReason,
    lastAuthFailure,
    wid: client?.info?.wid?._serialized || null,
  });
});

// Público: QR visible desde navegador
app.get("/qr", async (req, res) => {
  try {
    if (lastQR) {
      const qrImage = await qrcode.toDataURL(lastQR);
      return res.send(`<img src="${qrImage}" style="width:300px;height:300px;" />`);
    }
    return res.send("Esperando QR...");
  } catch (e) {
    return res.status(500).send("Error generando QR: " + e.message);
  }
});

// 🔐 Middleware de autenticación por API key (todo lo que viene debajo queda protegido)
app.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Acceso no autorizado: clave API inválida" });
  }
  next();
});

// ✅ Endpoint: reset total de credenciales + reinicio del cliente
app.post("/reset", async (req, res) => {
  try {
    console.log("🧨 RESET solicitado: destruyendo cliente y borrando sesión...");

    // 1) Apagar cliente
    try {
      await client.destroy();
    } catch (e) {
      console.warn("⚠️ destroy() falló o no era necesario:", e.message);
    }

    // 2) Borrar credenciales LocalAuth y cache
    await fs.rm(".wwebjs_auth", { recursive: true, force: true });
    await fs.rm(".wwebjs_cache", { recursive: true, force: true });

    // 3) Reset variables
    lastQR = null;
    isReady = false;
    lastState = "reset";
    lastDisconnectReason = null;
    lastAuthFailure = null;

    // 4) Re-inicializar
    await client.initialize();

    console.log("♻️ RESET completado. Revisa /qr para escanear.");
    return res.json({ status: "ok", message: "Reset completado. Abre /qr y escanea el nuevo QR." });
  } catch (err) {
    console.error("❌ Error en /reset:", err);
    return res.status(500).json({ error: err.message || "Error reseteando sesión" });
  }
});

// --- Endpoint principal /send ---
app.post("/send", async (req, res) => {
  let { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Faltan parámetros: to, message" });
  }

  try {
    // Normalización estricta
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

    if (!client.info || !client.info.wid || !isReady) {
      console.warn("⚠️ Cliente aún no está listo para enviar mensajes.");
      return res.status(503).json({ error: "Cliente WhatsApp aún no listo" });
    }

    console.log(`📩 Enviando mensaje a ${to}: ${message}`);
    let result;
    try {
      result = await client.sendMessage(to, message);
    } catch (e) {
      // Workaround: algunos builds de WhatsApp Web rompen sendSeen (markedUnread).
      // Reintentamos una vez tras un pequeño delay.
      console.warn("⚠️ sendMessage falló, reintentando 1 vez:", e?.message || e);
      await new Promise((r) => setTimeout(r, 800));
      result = await client.sendMessage(to, message);
    }

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

// --- Util: normalizar números a WIDs ---
function toWid(idLike) {
  if (/@(c|g)\.us$/i.test(idLike)) return idLike.trim();
  const clean = String(idLike || "").trim();
  const e164 = /^\+[1-9]\d{6,14}$/;
  if (!e164.test(clean)) throw new Error(`Número inválido (usa E.164): ${idLike}`);
  return `${clean.slice(1)}@c.us`;
}

// --- Endpoint: buscar grupo por nombre ---
app.post("/sync-group", async (req, res) => {
  const { groupName } = req.body;

  if (!groupName || typeof groupName !== "string") {
    return res.status(400).json({ error: "Falta el parámetro groupName (texto)" });
  }

  try {
    if (!client.info || !client.info.wid || !isReady) {
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

    if (!client.info || !client.info.wid || !isReady) {
      return res.status(503).json({ error: "Cliente WhatsApp aún no listo" });
    }

    let wids;
    try {
      wids = participants.map(toWid);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    console.log("🧪 Solicitud de creación de grupo:");
    console.log("   • Título:", groupTitle);
    console.log("   • Participantes:", wids.join(", "));

    const chat = await client.createGroup(groupTitle.trim(), wids);

    const groupId =
      (chat && chat.gid && chat.gid._serialized) ||
      (chat && chat.id && chat.id._serialized) ||
      (chat && chat.id && chat.id.id) ||
      null;

    const groupName = (chat && (chat.subject || chat.name)) || groupTitle.trim();

    console.log(`✅ Grupo creado: ${groupName} → ${groupId}`);

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


