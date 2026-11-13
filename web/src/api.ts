import type { DraftResult, PackageForm, PackageRequest } from "./types";

async function readError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) message = data.error;
  } catch {
    // The body was not JSON.
  }
  throw new Error(message);
}

export async function draftCourse(body: PackageRequest): Promise<DraftResult> {
  const response = await fetch("/api/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: body.version,
      organization: body.organization,
      note: body.note,
      lessons: body.lessons.map((lesson) => ({
        title: lesson.title,
        items: lesson.items.map((item) =>
          item.type === "quiz"
            ? { type: "quiz", title: item.title }
            : { type: "video", title: item.title, url: item.url }
        ),
      })),
    }),
  });
  if (!response.ok) {
    return readError(response, `Draft failed (${response.status}).`);
  }
  return (await response.json()) as DraftResult;
}

export async function importPackage(file: File): Promise<PackageForm> {
  const response = await fetch("/api/imports", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: file,
  });
  if (!response.ok) {
    return readError(response, `Open failed (${response.status}).`);
  }
  return (await response.json()) as PackageForm;
}

export async function buildPackage(
  body: PackageRequest
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/packages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return readError(response, `Build failed (${response.status}).`);
  }

  const header = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(header);
  const blob = await response.blob();
  return { blob, filename: match?.[1] || "course.zip" };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
