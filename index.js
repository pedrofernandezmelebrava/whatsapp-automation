import express from "express";
const app = express();

// Usa exclusivamente el puerto que Railway asigna
const PORT = process.env.PORT;

app.get("/", (req, res) => {
  res.send("✅ Servidor Express activo en Railway y respondiendo correctamente.");
});

app.get("/ping", (req, res) => {
  res.json({ status: "alive" });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`);
});


