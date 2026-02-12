import type { QRType } from "../type";

/**
 * Encode content into a QR-compatible string based on QR type.
 */
export function encodeQRContent(
  type: QRType,
  content: Record<string, unknown>,
): string {
  switch (type) {
    case "url":
      return encodeURL(content);
    case "text":
      return encodeText(content);
    case "wifi":
      return encodeWiFi(content);
    case "vcard":
      return encodeVCard(content);
    case "email":
      return encodeEmail(content);
    case "phone":
      return encodePhone(content);
    case "sms":
      return encodeSMS(content);
    case "line":
      return encodeLine(content);
    case "facebook":
      return encodeFacebook(content);
    default:
      throw new Error(`Unsupported QR type: ${type}`);
  }
}

// ─── Individual Encoders ──────────────────────────────────────────

function encodeURL(content: Record<string, unknown>): string {
  const url = String(content.url || "").trim();
  if (!url) throw new Error("URL is required");
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
}

function encodeText(content: Record<string, unknown>): string {
  const text = String(content.text || "").trim();
  if (!text) throw new Error("Text content is required");
  return text;
}

function encodeWiFi(content: Record<string, unknown>): string {
  const ssid = String(content.ssid || "").trim();
  if (!ssid) throw new Error("WiFi SSID is required");

  const password = String(content.password || "");
  const encryption = String(content.encryption || "WPA");
  const hidden = content.hidden === "true" || content.hidden === true;

  const escapedSSID = escapeWiFiField(ssid);
  const escapedPassword = escapeWiFiField(password);

  return `WIFI:T:${encryption};S:${escapedSSID};P:${escapedPassword};H:${hidden};;`;
}

function encodeVCard(content: Record<string, unknown>): string {
  const firstName = String(content.firstName || "").trim();
  const lastName = String(content.lastName || "").trim();

  if (!firstName && !lastName) {
    throw new Error("At least a first or last name is required");
  }

  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${lastName};${firstName};;;`,
    `FN:${firstName} ${lastName}`.trim(),
  ];

  if (content.phone) lines.push(`TEL:${String(content.phone).trim()}`);
  if (content.email) lines.push(`EMAIL:${String(content.email).trim()}`);
  if (content.org) lines.push(`ORG:${String(content.org).trim()}`);
  if (content.title) lines.push(`TITLE:${String(content.title).trim()}`);
  if (content.url) lines.push(`URL:${String(content.url).trim()}`);

  lines.push("END:VCARD");
  return lines.join("\n");
}

function encodeEmail(content: Record<string, unknown>): string {
  const to = String(content.to || "").trim();
  if (!to) throw new Error("Email address is required");

  const params: string[] = [];
  if (content.subject) {
    params.push(`subject=${encodeURIComponent(String(content.subject))}`);
  }
  if (content.body) {
    params.push(`body=${encodeURIComponent(String(content.body))}`);
  }

  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return `mailto:${to}${query}`;
}

function encodePhone(content: Record<string, unknown>): string {
  const phone = String(content.phone || "").trim();
  if (!phone) throw new Error("Phone number is required");
  return `tel:${phone}`;
}

function encodeSMS(content: Record<string, unknown>): string {
  const phone = String(content.phone || "").trim();
  if (!phone) throw new Error("Phone number is required");

  const message = String(content.message || "").trim();
  const query = message ? `?body=${encodeURIComponent(message)}` : "";
  return `sms:${phone}${query}`;
}

function encodeLine(content: Record<string, unknown>): string {
  const lineId = String(content.lineId || "").trim();
  if (!lineId) throw new Error("LINE ID is required");

  // Already a full URL
  if (/^https?:\/\//i.test(lineId)) return lineId;

  // Official account (@xxx) or personal ID
  const id = lineId.startsWith("@") ? lineId : `@${lineId}`;
  return `https://line.me/R/ti/p/${encodeURIComponent(id)}`;
}

function encodeFacebook(content: Record<string, unknown>): string {
  const input = String(content.facebookUrl || "").trim();
  if (!input) throw new Error("Facebook URL or username is required");

  // Already a full URL
  if (/^https?:\/\//i.test(input)) return input;

  return `https://www.facebook.com/${input}`;
}

// ─── Helpers ──────────────────────────────────────────────────────

function escapeWiFiField(value: string): string {
  return value.replace(/([\\;,":])/, "\\$1");
}
