import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MIME_BY_EXT, safeUploadPath } from "@/lib/uploads";

/** Sirve archivos subidos con soporte de Range (necesario para adelantar videos en iOS). */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[...path]">) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new Response("No autorizado", { status: 401 });

  const { path: parts } = await ctx.params;
  const filePath = safeUploadPath(parts);
  if (!filePath) return new Response("No encontrado", { status: 404 });

  let size: number;
  try {
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error();
    size = s.size;
  } catch {
    return new Response("No encontrado", { status: 404 });
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const type = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const baseHeaders = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
  };

  const range = request.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (!m) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    let start = m[1] ? Number(m[1]) : NaN;
    let end = m[2] ? Number(m[2]) : NaN;
    if (Number.isNaN(start)) {
      // bytes=-500: los últimos 500 bytes
      start = Math.max(0, size - end);
      end = size - 1;
    } else if (Number.isNaN(end) || end >= size) {
      end = size - 1;
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...baseHeaders, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...baseHeaders, "Content-Length": String(size) } });
}
