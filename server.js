require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const analyzeAudio = require("./api/analyze-audio");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.post("/api/analyze-audio", analyzeAudio);
app.use(express.static(__dirname));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ error: "Invalid JSON request." });
  }

  next(error);
});

app.listen(port, () => {
  console.log(`SpeakSpace is running at http://localhost:${port}`);
});
