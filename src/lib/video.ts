import type { VideoProvider } from "@/generated/prisma/enums";

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function detectVideoProvider(url: string): VideoProvider {
  if (url.startsWith("/api/media/")) return "UPLOAD";
  if (youtubeId(url)) return "YOUTUBE";
  return "EXTERNAL";
}

/** Tiempo de inicio en segundos si el link lo trae (?t=90 o ?start=90). */
export function youtubeStart(url: string): number | null {
  try {
    const u = new URL(url);
    const t = u.searchParams.get("t") ?? u.searchParams.get("start");
    if (!t) return null;
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (!m) return null;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeId(url);
  if (!id) return null;
  const start = youtubeStart(url);
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${start ? `&start=${start}` : ""}`;
}

export function youtubeThumb(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
