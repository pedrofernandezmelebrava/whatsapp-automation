import express from "express";
const app = express();

const PORT = process.env.PORT || 8080; // Usa el puerto dinámico de Railway

app.get("/", (req, res) => {
  res.send("✅ Servidor Express activo y respondiendo en Railway.");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`);
});

