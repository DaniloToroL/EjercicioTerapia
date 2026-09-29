import { ImageResponse } from "next/og";

/** Íconos de la PWA generados en el servidor (sin archivos binarios en el repo). */
export async function GET(_request: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = raw === "512" ? 512 : raw === "180" ? 180 : 192;
  const bar = Math.round(size * 0.1);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.03) }}>
          <div style={{ width: bar, height: size * 0.34, background: "#fbbf24", borderRadius: bar * 0.3 }} />
          <div style={{ width: bar * 0.8, height: size * 0.24, background: "#fbbf24", borderRadius: bar * 0.3 }} />
          <div style={{ width: size * 0.26, height: bar * 0.7, background: "#ffffff", borderRadius: bar * 0.3 }} />
          <div style={{ width: bar * 0.8, height: size * 0.24, background: "#fbbf24", borderRadius: bar * 0.3 }} />
          <div style={{ width: bar, height: size * 0.34, background: "#fbbf24", borderRadius: bar * 0.3 }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
