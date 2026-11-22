export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | boolean | number | null | undefined>,
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === "className") node.className = String(value);
      else if (key === "text") node.textContent = String(value);
      else if (value === true) node.setAttribute(key, "");
      else node.setAttribute(key, String(value));
    });
  }
  children.forEach((child) => {
    if (child == null) return;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  });
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

export function applyBackground(target: HTMLElement, specific: Record<string, unknown>): void {
  const bg = typeof specific.backgroundColor === "string" ? specific.backgroundColor : "";
  const color = typeof specific.textColor === "string" ? specific.textColor : "";
  if (bg && bg !== "#ffffff00") target.style.backgroundColor = bg;
  if (color) target.style.color = color;
  const image = typeof specific.backgroundImage === "string" ? specific.backgroundImage.trim() : "";
  if (image) {
    target.style.backgroundImage = `url(${JSON.stringify(image).slice(1, -1)})`;
    target.style.backgroundSize = "cover";
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function textOf(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}
