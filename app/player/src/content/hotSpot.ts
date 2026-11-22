import { asRecord, clear, el, textOf } from "./dom";
import { interaction } from "./score";
import type { MountContext } from "./types";

function rectFromAnnotation(annotation: Record<string, unknown>): { id: string; left: number; top: number; width: number; height: number } | null {
  const id = String(annotation.id || "");
  const target = asRecord(annotation.target);
  const selector = asRecord(target.selector);
  const value = asRecord(selector.value) || selector;
  // Support percentage or pixel-like numbers; treat as percent of image if <= 100 boxes often stored that way
  const left = Number(value.x ?? value.left ?? value.xPercent ?? NaN);
  const top = Number(value.y ?? value.top ?? value.yPercent ?? NaN);
  const width = Number(value.width ?? value.w ?? NaN);
  const height = Number(value.height ?? value.h ?? NaN);
  if (![left, top, width, height].every(Number.isFinite) || !id) return null;
  return { id, left, top, width, height };
}

export function mountHotSpot(ctx: MountContext): void {
  const specific = asRecord(ctx.item.specific);
  const image = textOf(specific.imageLink);
  const annotations = Array.isArray(specific.annotations) ? specific.annotations.map(asRecord) : [];
  const correctTags = new Set(
    (Array.isArray(specific.correctTags) ? specific.correctTags : []).map(String)
  );
  clear(ctx.root);
  ctx.root.classList.add("on");
  const panel = el("div", { className: "panel" });
  panel.append(el("h2", {}, textOf(specific.imageTitle, ctx.item.title)));
  if (!image) {
    panel.append(el("p", { className: "muted" }, "No hotspot image was provided."));
    ctx.root.append(panel);
    return;
  }
  const stage = el("div", { className: "hotspot-stage" });
  const img = el("img", { src: image, alt: textOf(specific.imageTitle) });
  stage.append(img);
  const picked = new Set<string>();
  const regions: HTMLButtonElement[] = [];

  function placeRegions(): void {
    regions.forEach((node) => node.remove());
    regions.length = 0;
    const bounds = img.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    annotations.forEach((annotation) => {
      const rect = rectFromAnnotation(annotation);
      if (!rect) return;
      const usePercent = rect.left <= 100 && rect.top <= 100 && rect.width <= 100 && rect.height <= 100;
      const button = el("button", {
        type: "button",
        className: "hotspot-region",
        style: usePercent
          ? `left:${rect.left}%;top:${rect.top}%;width:${rect.width}%;height:${rect.height}%;`
          : `left:${(rect.left / bounds.width) * 100}%;top:${(rect.top / bounds.height) * 100}%;width:${(rect.width / bounds.width) * 100}%;height:${(rect.height / bounds.height) * 100}%;`,
      }) as HTMLButtonElement;
      button.addEventListener("click", () => {
        if (picked.has(rect.id)) picked.delete(rect.id);
        else picked.add(rect.id);
        button.classList.toggle("picked", picked.has(rect.id));
      });
      stage.append(button);
      regions.push(button);
    });
  }

  img.addEventListener("load", placeRegions);
  if (img.complete) placeRegions();

  const submit = el("button", { type: "button", className: "primary" }, "Submit");
  const feedback = el("p", { className: "muted" });
  submit.addEventListener("click", () => {
    const ok =
      picked.size === correctTags.size && [...correctTags].every((tag) => picked.has(tag));
    const score = ok ? 100 : 0;
    feedback.textContent = ok
      ? textOf(specific.correctFeedback, "Correct.")
      : textOf(specific.incorrectFeedback, "Not quite.");
    const passed = score >= ctx.mastery;
    const complete = !ctx.requirePass || passed;
    ctx.reportScore(score, passed, complete, [
      interaction("hotspot-1", [...picked].join(","), ok, [...correctTags]),
    ]);
    submit.disabled = true;
  });
  panel.append(stage, submit, feedback);
  ctx.root.append(panel);
  ctx.setStatus("Select the correct region(s) on the image.");
}
