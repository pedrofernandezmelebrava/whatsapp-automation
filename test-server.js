import express from "express";
const app = express();

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("✅ Servidor Express básico funcionando en Railway.");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive", port: PORT });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor de prueba escuchando en puerto ${PORT}`);
});
