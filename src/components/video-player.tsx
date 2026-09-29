"use client";

import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import type { VideoProvider } from "@/generated/prisma/enums";
import { youtubeEmbedUrl, youtubeThumb } from "@/lib/video";
import { cn } from "@/lib/utils";

/**
 * Muestra el video del ejercicio dentro de la app. YouTube carga el iframe recién al tocar
 * (más liviano en listas largas); los videos subidos usan el reproductor nativo.
 */
export function VideoPlayer({
  provider,
  url,
  title,
  className,
  autoLoad = false,
}: {
  provider: VideoProvider;
  url: string | null;
  title: string;
  className?: string;
  autoLoad?: boolean;
}) {
  const [loaded, setLoaded] = useState(autoLoad);
  if (!url || provider === "NONE") return null;

  if (provider === "UPLOAD") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={cn("aspect-video w-full rounded-lg bg-black", className)}
        aria-label={`Video: ${title}`}
      />
    );
  }

  const embed = provider === "YOUTUBE" ? youtubeEmbedUrl(url) : null;
  if (!embed) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-2 text-sm text-primary underline", className)}>
        <ExternalLink className="size-4" /> Ver video
      </a>
    );
  }

  if (!loaded) {
    const thumb = youtubeThumb(url);
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className={cn("group relative block aspect-video w-full overflow-hidden rounded-lg bg-black", className)}
        aria-label={`Reproducir video: ${title}`}
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover opacity-80 transition-opacity group-hover:opacity-100" loading="lazy" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
            <Play className="ml-1 size-7 fill-current" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <iframe
      src={`${embed}&autoplay=1`}
      title={title}
      className={cn("aspect-video w-full rounded-lg bg-black", className)}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}
