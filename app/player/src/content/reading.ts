import { applyBackground, asRecord, clear, el, textOf } from "./dom";
import type { MountContext } from "./types";

function continueButton(onDone: () => void): HTMLButtonElement {
  const button = el("button", { type: "button", className: "btn" }, "Continue");
  button.addEventListener("click", onDone);
  return button;
}

export function mountText(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block panel" });
  applyBackground(block, specific);
  const title = textOf(specific.title, ctx.item.common?.contentName, ctx.item.title);
  const subtitle = textOf(specific.subtitle);
  const paragraph = textOf(specific.paragraph, ctx.item.common?.description);
  if (title) block.append(el("h2", { className: "hero-title" }, title));
  if (subtitle) block.append(el("p", { className: "subtitle" }, subtitle));
  if (paragraph) block.append(el("p", { className: "body" }, paragraph));
  const image = textOf(specific.featureImageLink);
  if (image) {
    block.append(el("img", { src: image, alt: "", style: "max-width:100%;border-radius:10px;" }));
  }
  block.append(
    continueButton(() => {
      ctx.reportComplete(true);
      ctx.setStatus(`Completed. Reported to ${ctx.apiName}.`);
    })
  );
  ctx.root.append(block);
  ctx.setStatus("Read the content, then continue.");
}

export function mountLink(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block panel" });
  applyBackground(block, specific);
  const title = textOf(specific.title, ctx.item.common?.contentName, ctx.item.title);
  const paragraph = textOf(specific.paragraph);
  const url = textOf(specific.url);
  const linkText = textOf(specific.linkText, url, "Open link");
  if (title) block.append(el("h2", { className: "hero-title" }, title));
  if (paragraph) block.append(el("p", { className: "body" }, paragraph));
  if (url) {
    const anchor = el("a", { className: "cta", href: url, target: "_blank", rel: "noopener noreferrer" }, linkText);
    block.append(anchor);
  }
  block.append(
    continueButton(() => {
      ctx.reportComplete(true);
      ctx.setStatus(`Completed. Reported to ${ctx.apiName}.`);
    })
  );
  ctx.root.append(block);
  ctx.setStatus("Open the link if needed, then continue.");
}

export function mountPdf(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block panel" });
  applyBackground(block, specific);
  const title = textOf(specific.title, specific.pdfText, ctx.item.title);
  const link = textOf(specific.pdfLink, specific.pdfFileURL);
  if (title) block.append(el("h2", { className: "hero-title" }, title));
  if (link) {
    block.append(
      el("a", { className: "cta", href: link, target: "_blank", rel: "noopener noreferrer" }, textOf(specific.pdfFileName, "Open PDF"))
    );
    const frame = el("iframe", {
      src: link,
      title: "PDF",
      style: "width:100%;min-height:60vh;border:0;border-radius:10px;background:#000;",
    });
    block.append(frame);
  } else {
    block.append(el("p", { className: "muted" }, "No PDF link was provided."));
  }
  const required = Boolean(specific.pdfIsRequired);
  block.append(
    continueButton(() => {
      ctx.reportComplete(true);
      ctx.setStatus(`Completed. Reported to ${ctx.apiName}.`);
    })
  );
  ctx.root.append(block);
  ctx.setStatus(required ? "Review the PDF, then continue." : "Open the PDF if needed, then continue.");
}

function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

export function mountMarkdown(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block panel" });
  applyBackground(block, specific);
  if (typeof specific.headingColor === "string") block.style.setProperty("--heading", specific.headingColor);
  if (typeof specific.linkColor === "string") block.style.setProperty("--link", specific.linkColor);
  const md = textOf(specific.markdownText);
  const body = el("div", { className: "body" });
  body.innerHTML = `<p>${simpleMarkdown(md)}</p>`;
  block.append(body);
  block.append(
    continueButton(() => {
      ctx.reportComplete(true);
      ctx.setStatus(`Completed. Reported to ${ctx.apiName}.`);
    })
  );
  ctx.root.append(block);
  ctx.setStatus("Read the content, then continue.");
}
