import { Elysia } from "elysia";
import { SimpleTemplate } from "../lib/simple-template";
import { VALID_QR_TYPES, type QRType } from "../type";

export const pageRoutes = new Elysia()

  // ─── Page Routes ──────────────────────────────────────────────

  .get("/", async () => {
    const html = await SimpleTemplate.renderPage("landing", {
      title: "QR forge",
      navGenerate: "active",
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  .get("/create", async () => {
    const html = await SimpleTemplate.renderPage("create", {
      title: "Generate QR Code",
      navGenerate: "active",
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  .get("/scan", async () => {
    const html = await SimpleTemplate.renderPage("scan", {
      title: "Scan QR Code",
      navScan: "active",
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  .get("/history", async () => {
    const html = await SimpleTemplate.renderPage("history", {
      title: "History",
      navHistory: "active",
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  // ─── HTMX Partial Routes ─────────────────────────────────────

  .get("/partials/history", async () => {
    const html = await SimpleTemplate.renderPartial("history", {
      title: "History",
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  .get("/partials/home", async () => {
    const html = await SimpleTemplate.renderPartial("home", {
      title: "Generate QR Code",
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  .get("/partials/qr-form/:type", async ({ params }) => {
    const type = params.type as QRType;

    if (!VALID_QR_TYPES.includes(type)) {
      return new Response("Invalid QR type", { status: 400 });
    }

    const html = await SimpleTemplate.renderPartial(`qr-form-${type}`, {
      type,
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  .get("/privacy", () => {
    return new Response(Bun.file("./public/page/privacy.html"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
