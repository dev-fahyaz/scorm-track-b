function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function courseHtml(title, lessonIndex, itemIndex) {
  const safe = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>${safe}</title>
  <style>
    body { margin: 0; background: #14181f; color: #f6f3ec; font-family: Georgia, "Iowan Old Style", serif; }
    main { max-width: 960px; margin: 0 auto; padding: 28px 16px 48px; }
    h1 { font-size: 1.6rem; font-weight: 600; margin: 0 0 14px; }
    video { width: 100%; background: #000; border-radius: 10px; }
    video.off, #youtube-frame, #quiz, #deck { display: none; }
    #deck.on { display: grid; gap: 12px; font-family: "Segoe UI", sans-serif; }
    #deck .stage { position: relative; background: #000; border-radius: 10px; overflow: hidden; }
    #deck img { display: block; width: 100%; height: auto; }
    #deck .hotspot { position: absolute; border: 0; padding: 0; background: transparent; cursor: pointer; }
    #deck .notes { margin: 0; color: #d5d0c6; white-space: pre-wrap; }
    #deck .deck-bar { display: flex; gap: 10px; align-items: center; }
    #deck .deck-bar button { border: 0; border-radius: 999px; padding: 10px 16px; background: #f6f3ec; color: #14181f; font-weight: 700; cursor: pointer; }
    #deck .deck-bar button:disabled { opacity: 0.5; cursor: default; }
    #youtube-frame.on { display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 10px; overflow: hidden; }
    #youtube-frame iframe { width: 100%; height: 100%; border: 0; }
    #quiz.on { display: block; font-family: "Segoe UI", sans-serif; }
    #quiz.overlay { display: flex; position: fixed; inset: 0; z-index: 8; align-items: center; justify-content: center; padding: 24px; background: rgba(8, 10, 14, 0.72); }
    #quiz .quiz-panel { display: grid; gap: 14px; }
    #quiz.overlay .quiz-panel { width: min(560px, 100%); max-height: calc(100vh - 48px); overflow: auto; padding: 22px; border-radius: 16px; background: #1c222c; border: 1px solid rgba(246, 243, 236, 0.14); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35); }
    #quiz h2 { font-family: Georgia, "Iowan Old Style", serif; font-size: 1.25rem; font-weight: 600; margin: 0; }
    #quiz fieldset { border: 0; margin: 0; padding: 0; }
    #quiz legend { padding: 0; font-weight: 650; }
    #quiz .choices { display: grid; gap: 8px; }
    #quiz .choice { display: flex; gap: 10px; align-items: center; margin: 0; padding: 12px 14px; border: 1px solid rgba(246, 243, 236, 0.16); border-radius: 12px; background: rgba(255, 255, 255, 0.04); cursor: pointer; }
    #quiz .choice.picked { border-color: #8fd0b4; background: rgba(14, 107, 86, 0.45); }
    #quiz .choice input { accent-color: #8fd0b4; }
    #quiz .quiz-note { margin: 0; color: #d5d0c6; }
    #quiz input[type="text"] { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid #3a4250; background: #14181f; color: #f6f3ec; }
    #quiz button { justify-self: start; border: 0; border-radius: 999px; padding: 10px 16px; background: #f6f3ec; color: #14181f; font-weight: 700; cursor: pointer; }
    #quiz button:disabled { opacity: 0.6; cursor: default; }
    #status { font-family: "Segoe UI", sans-serif; color: #d5d0c6; font-size: 0.92rem; }
  </style>
</head>
<body>
  <main>
    <h1>${safe}</h1>
    <video id="lesson" controls playsinline preload="metadata"></video>
    <div id="youtube-frame"><div id="youtube"></div></div>
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


module.exports = { courseHtml };
