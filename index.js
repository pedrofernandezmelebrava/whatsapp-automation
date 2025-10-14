import express from "express";
const app = express();

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("✅ Servidor Express activo y respondiendo correctamente.");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`);
});

