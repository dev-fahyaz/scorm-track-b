const path = require("path");
const fs = require("fs");
const os = require("os");
const esbuild = require("esbuild");
const express = require("express");
const { loadEnv } = require("./env");
const { buildCourse } = require("../app/course/assemble");
const { draftCourse } = require("../app/llm/draft");
const { importPackage } = require("../app/course/importPackage");
const { readPresentation } = require("../app/ppt/read");
const { loadDeck, saveDeck } = require("../app/ppt/store");

loadEnv();

const playerFile = path.join(__dirname, "..", "app", "player", "dist", "player.js");

function bundlePlayer() {
  fs.mkdirSync(path.dirname(playerFile), { recursive: true });
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "app", "player", "src", "player.ts")],
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
app.use(express.json({ limit: "12mb" }));

function llmOptions() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "",
  };
}

function sendError(res, error, fallback) {
  const status = error.status || 500;
  const message = error.expose || status !== 500 ? error.message : fallback;
  if (status === 500 && !error.expose) console.error(error);
  res.status(status).json({ error: message });
}

app.post("/api/draft", async (req, res) => {
  try {
    res.json(await draftCourse(req.body || {}, llmOptions()));
  } catch (error) {
    sendError(res, error, "The draft could not be created.");
  }
});

app.post(
  "/api/imports",
  express.raw({
    type: ["application/zip", "application/octet-stream", "application/x-zip-compressed"],
    limit: "40mb",
  }),
  (req, res) => {
    try {
      res.json(importPackage(req.body, saveDeck));
    } catch (error) {
      sendError(res, error, "The zip could not be opened.");
    }
  }
);

app.post(
  "/api/presentations",
  express.raw({
    type: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/octet-stream",
    ],
    limit: "40mb",
  }),
  (req, res) => {
    const root = path.join(os.tmpdir(), "scorm-track-b", "upload");
    const pptx = path.join(root, `${Date.now()}.pptx`);
    try {
      fs.mkdirSync(root, { recursive: true });
      if (!Buffer.isBuffer(req.body) || req.body.length < 4) {
        res.status(400).json({ error: "Choose a PowerPoint file." });
        return;
      }
      fs.writeFileSync(pptx, req.body);
      const deck = readPresentation(pptx);
      const named = String(req.get("x-deck-name") || "").replace(/\.pptx$/i, "").replace(/[\\/]/g, "").trim();
      if (named) {
        deck.title = named.slice(0, 120);
        fs.writeFileSync(path.join(deck.dir, "deck.json"), JSON.stringify({
          title: deck.title,
          width: deck.width,
          height: deck.height,
          slides: deck.slides,
        }));
      }
      const deckId = saveDeck(deck);
      fs.rmSync(deck.dir, { recursive: true, force: true });
      res.json({
        deckId,
        title: deck.title,
        width: deck.width,
        height: deck.height,
        slides: deck.slides.map((slide) => ({
          title: slide.title,
          notes: slide.notes,
          links: slide.links,
        })),
      });
    } catch (error) {
      sendError(res, error, "The presentation could not be read.");
    } finally {
      fs.rmSync(pptx, { force: true });
    }
  }
);

app.post("/api/packages", async (req, res) => {
  try {
    const result = await buildCourse(req.body || {}, playerFile, loadDeck);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(result.buffer);
  } catch (error) {
    sendError(res, error, "The package could not be built.");
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  const server = app.listen(port, () => {
    console.log(`Track B API listening on ${port}`);
  });
  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Stop the other process, or keep using that API and run the dashboard with: npm run dev:ui`
      );
      process.exit(1);
    }
    throw error;
  });
}

module.exports = { app, bundlePlayer };
