"use strict";

const { baseCss } = require("./base.css");

function shellHtml(title, lessonIndex, itemIndex) {
  const safe = String(title)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>${safe}</title>
  <style>${baseCss()}</style>
</head>
<body>
  <main>
    <h1>${safe}</h1>
    <video id="lesson" controls playsinline preload="metadata"></video>
    <div id="youtube-frame"><div id="youtube"></div></div>
    <div id="content"></div>
    <div id="quiz"></div>
    <div id="deck"></div>
    <p id="status">Loading lesson…</p>
  </main>
  <script>window.LESSON_INDEX = ${Number(lessonIndex)};window.ITEM_INDEX = ${Number(itemIndex)};</script>
  <script src="player.js"></script>
</body>
</html>
`;
}

module.exports = { shellHtml, baseCss };
