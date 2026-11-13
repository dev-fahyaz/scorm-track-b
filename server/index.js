const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");
const express = require("express");
const { loadEnv } = require("./env");
const { buildCourse } = require("./build");
const { draftCourse } = require("./draft");
const { importPackage } = require("./import");

loadEnv();

const playerFile = path.join(__dirname, "..", "sco", "dist", "player.js");

function bundlePlayer() {
  fs.mkdirSync(path.dirname(playerFile), { recursive: true });
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "sco", "src", "player.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    outfile: playerFile,
    legalComments: "none",
  });
}

bundlePlayer();

const app = express();
app.use(express.json({ limit: "8mb" }));

app.post("/api/draft", async (req, res) => {
  try {
    const result = await draftCourse(req.body || {});
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    const message = error.expose ? error.message : "The draft could not be created.";
    if (!error.expose) console.error(error);
    res.status(status).json({ error: message });
  }
});

app.post(
  "/api/imports",
  express.raw({
    type: ["application/zip", "application/octet-stream", "application/x-zip-compressed"],
    limit: "20mb",
  }),
  (req, res) => {
    try {
      res.json(importPackage(req.body));
    } catch (error) {
      const status = error.status || 500;
      const message = error.expose ? error.message : "The zip could not be opened.";
      if (!error.expose) console.error(error);
      res.status(status).json({ error: message });
    }
  }
);

app.post("/api/packages", async (req, res) => {
  try {
    const result = await buildCourse(req.body || {}, playerFile);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(result.buffer);
  } catch (error) {
    const status = error.status || 500;
    const message = status === 500 ? "The package could not be built." : error.message;
    if (status === 500) console.error(error);
    res.status(status).json({ error: message });
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => {
    console.log(`Track B API listening on ${port}`);
  });
}

module.exports = { app, bundlePlayer };
