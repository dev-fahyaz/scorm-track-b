const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

interface YouTubePlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  pauseVideo(): void;
  playVideo(): void;
  destroy(): void;
}

interface YouTubeNamespace {
  Player: new (elementId: string, options: {
    videoId: string;
    host?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: YouTubePlayer }) => void;
      onStateChange?: (event: { data: number }) => void;
      onError?: (event: { data: number }) => void;
    };
  }) => YouTubePlayer;
  PlayerState?: { ENDED: number; PLAYING: number };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function youtubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  let id = "";
  if (host === "youtu.be") {
    id = parsed.pathname.split("/").filter(Boolean)[0] || "";
  } else if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    if (parsed.pathname === "/watch") {
      id = parsed.searchParams.get("v") || "";
    } else {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live", "v"].includes(parts[0] || "") && parts[1]) {
        id = parts[1].split("?")[0];
      }
    }
  }
  return VIDEO_ID.test(id) ? id : null;
}

let loading: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = window.setTimeout(() => reject(new Error("timeout")), 8000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer);
      if (typeof previous === "function") previous();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("script"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export interface YouTubeHandle {
  ok: boolean;
  pause(): void;
  play(): void;
  seek(seconds: number): void;
  stop(): void;
}

export async function mountYouTube(options: {
  elementId: string;
  videoId: string;
  resume: number;
  onTime: (current: number, duration: number) => void;
  onEnded: () => void;
  onPlay?: () => void;
  onError: (message: string) => void;
}): Promise<YouTubeHandle> {
  try {
    await loadApi();
  } catch {
    options.onError("YouTube could not be loaded, so playback could not be tracked.");
    return { ok: false, pause() {}, play() {}, seek() {}, stop() {} };
  }
  const yt = window.YT;
  if (!yt) {
    options.onError("YouTube could not be loaded, so playback could not be tracked.");
    return { ok: false, pause() {}, play() {}, seek() {}, stop() {} };
  }

  let player: YouTubePlayer | null = null;
  let ready = false;
  const timer = window.setInterval(() => {
    if (!player || !ready) return;
    try {
      options.onTime(player.getCurrentTime(), player.getDuration());
    } catch {
      // The player is not ready for a time read yet.
    }
  }, 500);

  const playerVars: Record<string, string | number> = { rel: 0, playsinline: 1 };
  const origin = window.location.origin;
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    playerVars.origin = origin;
    playerVars.widget_referrer = window.location.href;
  }

  player = new yt.Player(options.elementId, {
    videoId: options.videoId,
    playerVars,
    events: {
      onReady: (event) => {
        ready = true;
        if (options.resume > 0) {
          try {
            event.target.seekTo(options.resume, true);
          } catch {
            // Seeking before the stream is ready is ignored.
          }
        }
      },
      onStateChange: (event) => {
        const ended = yt.PlayerState ? yt.PlayerState.ENDED : 0;
        const playing = yt.PlayerState ? yt.PlayerState.PLAYING : 1;
        if (event.data === ended) options.onEnded();
        if (event.data === playing) options.onPlay?.();
      },
      onError: (event) => {
        const code = event && event.data;
        if (code === 101 || code === 150) {
          options.onError("The owner has disabled embedding for this video.");
          return;
        }
        options.onError("The YouTube video could not be loaded.");
      },
    },
  });

  return {
    ok: true,
    pause() {
      try {
        player?.pauseVideo();
      } catch {
        // The player is not ready.
      }
    },
    play() {
      try {
        player?.playVideo();
      } catch {
        // The player is not ready.
      }
    },
    seek(seconds: number) {
      try {
        player?.seekTo(seconds, true);
      } catch {
        // Seeking before the stream is ready is ignored.
      }
    },
    stop() {
      window.clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        // The iframe may already be gone.
      }
    },
  };
}
