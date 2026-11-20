import { mountYouTube, youtubeId, type YouTubeHandle } from "./youtube";

export interface SlideLink {
  text?: string;
  url?: string;
  type?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export interface DeckSlide {
  title?: string;
  notes?: string;
  image?: string;
  links?: SlideLink[];
}

interface Watch {
  note: (current: number, duration: number) => void;
  report: (finish: boolean) => void;
  bookmark: number;
}

function coverSlide(index: number, count: number, note: (current: number, duration: number) => void): void {
  const first = Math.min(99, Math.floor((index / count) * 100));
  const last = Math.floor((((index + 1) / count) * 100)) - 1;
  const end = Math.min(99, Math.max(first, last));
  for (let bit = first; bit <= end; bit += 1) note(bit + 0.5, 100);
}

export function mountDeck(options: {
  root: HTMLElement;
  slides: DeckSlide[];
  video: HTMLVideoElement;
  youtubeFrame: HTMLElement;
  watch: Watch;
  place: { current: number };
}): void {
  const slides = options.slides.filter((slide) => slide.image);
  if (!slides.length) return;
  const root = options.root;
  root.classList.add("on");
  let index = Math.min(Math.max(0, Math.round(options.watch.bookmark)), slides.length - 1);
  let handle: YouTubeHandle | null = null;
  let generation = 0;

  const stage = document.createElement("div");
  stage.className = "stage";
  const image = document.createElement("img");
  image.alt = "";
  const notes = document.createElement("p");
  notes.className = "notes";
  const bar = document.createElement("div");
  bar.className = "deck-bar";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "Previous";
  const position = document.createElement("span");
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  bar.append(previous, position, next);
  root.append(stage, notes, bar);
  stage.append(image);

  const resetMedia = () => {
    generation += 1;
    if (handle) {
      handle.stop();
      handle = null;
    }
    options.video.pause();
    options.video.removeAttribute("src");
    options.video.classList.add("off");
    options.youtubeFrame.classList.remove("on");
    if (!document.getElementById("youtube")) {
      const slot = document.createElement("div");
      slot.id = "youtube";
      options.youtubeFrame.append(slot);
    }
  };

  const showSlide = () => {
    resetMedia();
    const slide = slides[index];
    image.src = slide.image || "";
    image.alt = slide.title || `Slide ${index + 1}`;
    notes.textContent = slide.notes || "";
    position.textContent = `${index + 1} of ${slides.length}`;
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    stage.querySelectorAll(".hotspot").forEach((node) => node.remove());
    (slide.links || []).forEach((link) => {
      if (!link.url) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      button.title = link.text || link.url;
      button.style.left = `${Number(link.left) || 0}%`;
      button.style.top = `${Number(link.top) || 0}%`;
      button.style.width = `${Number(link.width) || 0}%`;
      button.style.height = `${Number(link.height) || 0}%`;
      button.addEventListener("click", () => openLink(link));
      stage.append(button);
    });
    options.place.current = index;
    coverSlide(index, slides.length, options.watch.note);
    options.watch.report(false);
  };

  const openLink = (link: SlideLink) => {
    const url = link.url || "";
    const id = youtubeId(url);
    if (link.type === "youtube" && id) {
      options.youtubeFrame.classList.add("on");
      const ticket = generation;
      void mountYouTube({
        elementId: "youtube",
        videoId: id,
        resume: 0,
        onTime: () => undefined,
        onEnded: () => undefined,
        onError: (message) => {
          notes.textContent = message;
        },
      }).then((next) => {
        if (ticket !== generation) {
          next.stop();
          return;
        }
        handle = next;
      });
      return;
    }
    if (link.type === "mp4") {
      options.video.classList.remove("off");
      options.video.src = url;
      void options.video.play();
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  previous.addEventListener("click", () => {
    if (index > 0) {
      index -= 1;
      showSlide();
    }
  });
  next.addEventListener("click", () => {
    if (index < slides.length - 1) {
      index += 1;
      showSlide();
    }
  });
  showSlide();
}
