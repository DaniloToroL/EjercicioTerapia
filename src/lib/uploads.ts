import "server-only";
import path from "path";

export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 300) * 1024 * 1024;

export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

/** Resuelve una ruta dentro de UPLOAD_DIR impidiendo salir de la carpeta. */
export function safeUploadPath(parts: string[]) {
  const resolved = path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR, ...parts);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) return null;
  return resolved;
}
