import { Elysia, t } from "elysia";
import { SimpleTemplate } from "../lib/simple-template";
import { generateQR } from "../service/qr-generator";
import { encodeQRContent } from "../util/qr-encoder";
import { parseQRStyle, type QRStyle, type QRType } from "../type";

// ─── Shared helpers ───────────────────────────────────────────────

/** Restructure flat form keys (content.url, style.fgColor) into nested object */
function restructureBody(raw: Record<string, any>): {
  type: QRType;
  content: Record<string, string>;
  style: Record<string, string>;
  format: string;
} {
  // Already nested (JSON API call)
  if (
    raw.content &&
    typeof raw.content === "object" &&
    !Array.isArray(raw.content)
  ) {
    return {
      type: String(raw.type || "text") as QRType,
      content: raw.content as Record<string, string>,
      style: (raw.style || {}) as Record<string, string>,
      format: String(raw.format || "png"),
    };
  }

  // Flat form data (HTMX form submission)
  const result = {
    type: String(raw.type || "text") as QRType,
    content: {} as Record<string, string>,
    style: {} as Record<string, string>,
    format: String(raw.format || "png"),
  };

  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("content.")) {
      result.content[key.replace("content.", "")] = String(value);
    }
    if (key.startsWith("style.")) {
      result.style[key.replace("style.", "")] = String(value);
    }
  }

  return result;
}

/** Build HTMX HTML response for generated QR */
function buildPreviewHtml(
  dataUrl: string,
  style: QRStyle,
  format: string,
): string {
  return `
    <div class="flex flex-col items-center gap-4">
      <img
        src="${dataUrl}"
        alt="Generated QR Code"
        class="rounded-xl w-full max-w-[280px] border border-base-200 shadow-sm"
      />
      <div class="text-xs text-base-content/40 font-mono">
        ${style.width} × ${style.width}px · ${format.toUpperCase()} · EC: ${style.ecLevel}
      </div>
      <div class="flex gap-2 w-full">
        <button
          onclick="downloadQR('png')"
          class="btn btn-sm btn-outline border-base-300 hover:btn-primary flex-1 gap-1"
        >
          📥 PNG
        </button>
        <button
          onclick="downloadQR('svg')"
          class="btn btn-sm btn-outline border-base-300 hover:btn-primary flex-1 gap-1"
        >
          📥 SVG
        </button>
      </div>
      <button
        id="save-to-history-btn"
        onclick="saveToHistory()"
        class="btn btn-sm btn-ghost text-base-content/50 w-full gap-1"
      >
        💾 Save to History
      </button>
    </div>
  `;
}

/** Build HTMX error HTML */
function buildErrorHtml(message: string): string {
  return `
    <div class="flex flex-col items-center justify-center py-8 text-center">
      <div class="text-4xl mb-3">⚠️</div>
      <p class="text-error text-sm font-medium">${SimpleTemplate.escapeHtml(message)}</p>
      <p class="text-base-content/40 text-xs mt-1">Check your input and try again</p>
    </div>
  `;
}

// ─── Route Definition ─────────────────────────────────────────────

export const apiRoutes = new Elysia()

  // ─── POST /api/qr/generate ────────────────────────────────────
  .post(
    "/api/qr/generate",
    async ({ body: rawBody, headers }) => {
      const isHtmx = headers["hx-request"] === "true";

      try {
        const body = restructureBody(rawBody as Record<string, any>);
        const qrString = encodeQRContent(body.type, body.content);
        const style = parseQRStyle(body.style);
        let format = (body.format as "png" | "svg") || "png";
        const qrBuffer = await generateQR(qrString, style, format);

        if (isHtmx) {
          const base64 = Buffer.from(qrBuffer).toString("base64");
          const mimeType = format === "svg" ? "image/svg+xml" : "image/png";
          const dataUrl = `data:${mimeType};base64,${base64}`;
          const html = buildPreviewHtml(dataUrl, style, format);
          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        const contentType = format === "svg" ? "image/svg+xml" : "image/png";
        return new Response(Buffer.from(qrBuffer), {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="qr-code.${format}"`,
            "Cache-Control": "no-store",
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "QR generation failed";
        if (isHtmx) {
          return new Response(buildErrorHtml(message), {
            status: 422,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        return new Response(JSON.stringify({ error: message }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
    { body: t.Any() },
  )

  // ─── GET /api/qr/generate (for HTMX hx-get) ─────────────────
  .get("/api/qr/generate", async ({ query, headers }) => {
    const body = restructureBody(query as Record<string, any>);
    const isHtmx = headers["hx-request"] === "true";

    try {
      const qrString = encodeQRContent(body.type, body.content);
      const style = parseQRStyle(body.style);
      let format = (body.format as "png" | "svg") || "png";

      const qrBuffer = await generateQR(qrString, style, format);

      if (isHtmx) {
        const base64 = Buffer.from(qrBuffer).toString("base64");
        const mimeType = format === "svg" ? "image/svg+xml" : "image/png";
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return new Response(buildPreviewHtml(dataUrl, style, format), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const contentType = format === "svg" ? "image/svg+xml" : "image/png";
      return new Response(Buffer.from(qrBuffer), {
        headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "QR generation failed";
      if (isHtmx) {
        return new Response(buildErrorHtml(message), {
          status: 422,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response(JSON.stringify({ error: message }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
  })

  // ─── GET /api/qr/download ─────────────────────────────────────
  .get("/api/qr/download", async ({ query }) => {
    try {
      const body = restructureBody(query as Record<string, any>);
      const qrString = encodeQRContent(body.type, body.content);
      const style = parseQRStyle(body.style);
      let format = (body.format as "png" | "svg") || "png";
      const width = Number(query.width) || style.width;
      style.width = width;

      const qrBuffer = await generateQR(qrString, style, format);
      const contentType = format === "svg" ? "image/svg+xml" : "image/png";
      const ext = format === "svg" ? "svg" : "png";

      return new Response(Buffer.from(qrBuffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="qr-forge-${Date.now()}.${ext}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Download failed",
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
  });
