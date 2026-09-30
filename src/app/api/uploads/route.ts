import { randomBytes } from "crypto";
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { getCurrentUser, isCoach } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD_BYTES, UPLOAD_DIR, VIDEO_TYPES } from "@/lib/uploads";

/**
 * Sube un video de ejercicio. El cuerpo es el archivo en crudo (no multipart)
 * para escribirlo a disco en streaming sin cargarlo en memoria.
 * POST /api/uploads?exerciseId=...  Content-Type: video/mp4
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isCoach(user)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const exerciseId = new URL(request.url).searchParams.get("exerciseId");
  if (!exerciseId) return Response.json({ error: "Falta exerciseId" }, { status: 400 });
  const exercise = await prisma.exercise.findFirst({
    // La biblioteca global solo la modifica el superadmin.
    where: { id: exerciseId, OR: [{ orgId: user.orgId }, ...(user.isSuperadmin ? [{ orgId: null }] : [])] },
  });
  if (!exercise) return Response.json({ error: "Ejercicio no encontrado" }, { status: 404 });

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = VIDEO_TYPES[type];
  if (!ext) return Response.json({ error: "Formato no soportado. Usa MP4, WebM o MOV." }, { status: 415 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return Response.json({ error: "El archivo supera el tamaño máximo" }, { status: 413 });
  if (!request.body) return Response.json({ error: "Archivo vacío" }, { status: 400 });

  const dir = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, "videos");
  await mkdir(dir, { recursive: true });
  const fileName = `${exercise.id}-${randomBytes(6).toString("hex")}.${ext}`;
  const filePath = path.join(/*turbopackIgnore: true*/ dir, fileName);

  let received = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES) cb(new Error("too-large"));
      else cb(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(request.body as unknown as NodeReadableStream), limiter, createWriteStream(filePath));
  } catch (e) {
    await unlink(filePath).catch(() => {});
    const tooLarge = e instanceof Error && e.message === "too-large";
    return Response.json({ error: tooLarge ? "El archivo supera el tamaño máximo" : "No se pudo guardar el archivo" }, { status: tooLarge ? 413 : 500 });
  }

  // Si el ejercicio ya tenía un video subido, se elimina el archivo anterior.
  if (exercise.videoProvider === "UPLOAD" && exercise.videoUrl?.startsWith("/api/media/videos/")) {
    const old = path.join(/*turbopackIgnore: true*/ dir, path.basename(exercise.videoUrl));
    await unlink(old).catch(() => {});
  }

  const url = `/api/media/videos/${fileName}`;
  await prisma.exercise.update({ where: { id: exercise.id }, data: { videoUrl: url, videoProvider: "UPLOAD" } });
  return Response.json({ url });
}
