import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

// --- Inicializa cliente WhatsApp Web ---
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth" // usa la sesión guardada si ya la tienes
  }),
  puppeteer: {
    headless: false, // muestra la ventana de Chrome
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  }
});

// --- Eventos de conexión ---
client.on("qr", qr => {
  console.log("📱 Escanea este QR con tu móvil para iniciar sesión en WhatsApp Web:");
  console.log(qr);
});

client.on("authenticated", () => {
  console.log("🔐 Autenticación correcta, cargando cliente...");
});

client.on("ready", async () => {
  console.log("✅ Cliente WhatsApp conectado.");
  console.log("🔍 Obteniendo lista de grupos...");

  try {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);

    if (groups.length === 0) {
      console.log("⚠️ No se encontraron grupos en esta cuenta.");
    } else {
      console.log(`📋 Se encontraron ${groups.length} grupos:\n`);
      groups.forEach(g =>
        console.log(`👉 ${g.name} → ${g.id._serialized}`)
      );
    }
  } catch (err) {
    console.error("❌ Error al obtener los grupos:", err);
  } finally {
    // Termina el proceso una vez listados
    process.exit(0);
  }
});

client.on("auth_failure", err => {
  console.error("❌ Error de autenticación:", err);
});

client.on("disconnected", reason => {
  console.warn("⚠️ Cliente desconectado:", reason);
});

// --- Inicializa ---
client.initialize().catch(err => console.error("❌ Error al iniciar el cliente:", err));
