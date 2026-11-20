"""Read a PowerPoint file into slide images, notes, and links."""

import json
import sys
import zipfile
from pathlib import Path

from pptx import Presentation


def classify_link(url):
    lowered = url.lower()
    if "youtube.com" in lowered or "youtu.be" in lowered:
        return "youtube"
    if lowered.endswith(".mp4") or ".mp4?" in lowered:
        return "mp4"
    return "link"


def shape_link(shape):
    try:
        url = shape.click_action.hyperlink.address
    except AttributeError:
        return None
    if not url:
        return None
    text = shape.text.strip() if hasattr(shape, "text") else ""
    return link_box(shape, text, url)


def run_links(shape):
    found = []
    if not hasattr(shape, "text_frame"):
        return found
    for paragraph in shape.text_frame.paragraphs:
        for run in paragraph.runs:
            try:
                url = run.hyperlink.address
            except AttributeError:
                continue
            if url:
                found.append(link_box(shape, run.text.strip(), url))
    return found


def link_box(shape, text, url):
    return {
        "text": text,
        "url": url,
        "type": classify_link(url),
        "left": int(shape.left),
        "top": int(shape.top),
        "width": int(shape.width),
        "height": int(shape.height),
    }


def percent(value, total):
    if not total:
        return 0
    return round((value / total) * 1000) / 10


def export_images(pptx_file, folder):
    import win32com.client

    powerpoint = win32com.client.Dispatch("PowerPoint.Application")
    try:
        presentation = powerpoint.Presentations.Open(str(pptx_file), WithWindow=False)
        presentation.SaveAs(str(folder), 17)
        presentation.Close()
    except Exception as error:
        raise SystemExit(f"PowerPoint could not export the slides. {error}") from error
    finally:
        powerpoint.Quit()


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: export_deck.py presentation.pptx output_dir")
    pptx_file = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    slides_dir = output / "slides"
    media_dir = output / "media"
    slides_dir.mkdir(parents=True, exist_ok=True)
    media_dir.mkdir(parents=True, exist_ok=True)
    if not pptx_file.exists():
        raise SystemExit(f"File not found: {pptx_file}")

    export_images(pptx_file, slides_dir)
    images = sorted(slides_dir.glob("*.jpg"), key=lambda path: int("".join(ch for ch in path.stem if ch.isdigit()) or 0))
    images += sorted(slides_dir.glob("*.JPG"), key=lambda path: int("".join(ch for ch in path.stem if ch.isdigit()) or 0))
    seen = set()
    unique = []
    for image in images:
        key = image.name.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(image)
    if not unique:
        raise SystemExit("PowerPoint did not write any slide images.")

    presentation = Presentation(str(pptx_file))
    width = int(presentation.slide_width)
    height = int(presentation.slide_height)
    slides = []
    for index, image in enumerate(unique):
        slide = presentation.slides[index] if index < len(presentation.slides) else None
        title = ""
        notes = ""
        links = []
        if slide is not None:
            try:
                if slide.shapes.title and slide.shapes.title.text:
                    title = slide.shapes.title.text.strip()
            except Exception:
                title = ""
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes = slide.notes_slide.notes_text_frame.text or ""
            for shape in slide.shapes:
                direct = shape_link(shape)
                if direct:
                    links.append(direct)
                links.extend(run_links(shape))
        named = f"slide-{index + 1}{image.suffix.lower()}"
        target = slides_dir / named
        if image.resolve() != target.resolve():
            image.replace(target)
        slides.append({
            "title": title or f"Slide {index + 1}",
            "notes": notes,
            "image": f"slides/{named}",
            "links": [
                {
                    "text": link["text"],
                    "url": link["url"],
                    "type": link["type"],
                    "left": percent(link["left"], width),
                    "top": percent(link["top"], height),
                    "width": percent(link["width"], width),
                    "height": percent(link["height"], height),
                }
                for link in links
            ],
        })

    with zipfile.ZipFile(pptx_file) as archive:
        for name in archive.namelist():
            if not name.startswith("ppt/media/") or name.endswith("/"):
                continue
            target = media_dir / Path(name).name
            target.write_bytes(archive.read(name))

    deck = {
        "title": pptx_file.stem,
        "width": width,
        "height": height,
        "slides": slides,
    }
    (output / "deck.json").write_text(json.dumps(deck), encoding="utf-8")


if __name__ == "__main__":
    main()
