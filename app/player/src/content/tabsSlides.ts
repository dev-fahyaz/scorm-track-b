import { applyBackground, asRecord, clear, el, textOf } from "./dom";
import type { MountContext } from "./types";

export function mountTabs(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const sections = Array.isArray(specific.tabSections) ? specific.tabSections : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block panel" });
  applyBackground(block, specific);
  block.append(el("h2", { className: "hero-title" }, textOf(specific.title, ctx.item.title)));
  if (textOf(specific.paragraph)) block.append(el("p", { className: "body" }, textOf(specific.paragraph)));

  const nav = el("div", { className: "tab-nav" });
  const body = el("div", { className: "tab-body body" });
  let index = 0;

  function render() {
    nav.replaceChildren();
    sections.forEach((entry, i) => {
      const section = asRecord(entry);
      const extra = asRecord(section.additionalProperties);
      const label = textOf(extra.navigationButtonText, section.title, `Tab ${i + 1}`);
      const button = el("button", { type: "button", className: i === index ? "active" : "" }, label);
      button.addEventListener("click", () => {
        index = i;
        render();
      });
      nav.append(button);
    });
    const current = asRecord(sections[index]);
    const extra = asRecord(current.additionalProperties);
    body.replaceChildren();
    body.append(el("p", {}, textOf(extra.paragraph, current.paragraph, "")));
  }

  render();
  block.append(nav, body);
  block.append(
    el("div", { className: "content-bar" }, (() => {
      const button = el("button", { type: "button", className: "btn btn-continue" }, "Continue");
      button.addEventListener("click", () => {
        ctx.reportComplete(true);
      });
      return button;
    })())
  );
  ctx.root.append(block);
  ctx.setStatus("Review each tab, then continue.");
}

export function mountSliderShow(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const slides = Array.isArray(specific.slides) ? specific.slides : [];
  clear(ctx.root);
  ctx.root.classList.add("on");
  const block = el("div", { className: "content-block panel" });
  applyBackground(block, specific);
  const stage = el("div", { className: "slide-stage body" });
  const dots = el("div", { className: "slide-dots" });
  let index = 0;

  function render() {
    const slide = asRecord(slides[index]);
    stage.replaceChildren();
    if (textOf(slide.title)) stage.append(el("h2", { className: "hero-title" }, textOf(slide.title)));
    if (textOf(slide.subtitle)) stage.append(el("p", { className: "subtitle" }, textOf(slide.subtitle)));
    if (textOf(slide.paragraph)) stage.append(el("p", {}, textOf(slide.paragraph)));
    const image = textOf(slide.featureImageLink);
    if (image) stage.append(el("img", { src: image, alt: "", style: "max-width:100%;border-radius:10px;" }));
    dots.replaceChildren();
    slides.forEach((_, i) => {
      const button = el("button", { type: "button", className: i === index ? "active" : "" }, String(i + 1));
      button.addEventListener("click", () => {
        index = i;
        render();
      });
      dots.append(button);
    });
  }

  render();
  const bar = el("div", { className: "content-bar" });
  const prev = el("button", { type: "button", className: "btn btn-secondary" }, "Previous");
  const next = el("button", { type: "button", className: "btn btn-continue" }, "Next");
  prev.addEventListener("click", () => {
    index = Math.max(0, index - 1);
    render();
  });
  next.addEventListener("click", () => {
    if (index >= slides.length - 1) {
      ctx.reportComplete(true);
      return;
    }
    index += 1;
    render();
  });
  bar.append(prev, next);
  block.append(stage, dots, bar);
  ctx.root.append(block);
  ctx.setStatus(slides.length ? "Move through the slides." : "No slides were provided.");
  if (!slides.length) {
    ctx.reportComplete(true);
  }
}
