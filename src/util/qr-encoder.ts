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
    case "promptpay":
      return encodePromptPay(content);
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

// ─── PromptPay (EMVCo Merchant Presented Mode) ───────────────────

function encodePromptPay(content: Record<string, unknown>): string {
  const rawId = String(content.promptpayId || "").trim();
  if (!rawId) throw new Error("PromptPay ID is required");

  const amount = content.amount ? parseFloat(String(content.amount)) : 0;
  if (amount < 0) throw new Error("Amount cannot be negative");

  return generatePromptPayPayload(rawId, amount > 0 ? amount : undefined);
}

/**
 * Generate EMVCo QR Code payload string for PromptPay
 *
 * Format: EMV QRCPS Merchant Presented Mode
 * Reference: Bank of Thailand / EMVCo specification
 *
 * TLV structure (Tag-Length-Value):
 *   00 - Payload Format Indicator: "01"
 *   01 - Point of Initiation: "11" (static) or "12" (dynamic / with amount)
 *   29 - Merchant Account Info (PromptPay):
 *        00 - App ID: "A000000677010111"
 *        01 - Mobile (13 digits, 0066xxxxxxxxx)
 *        02 - National ID / Tax ID (13 digits)
 *        03 - E-Wallet ID (15 digits)
 *   53 - Transaction Currency: "764" (THB)
 *   54 - Transaction Amount (optional)
 *   58 - Country Code: "TH"
 *   63 - CRC checksum
 */
function generatePromptPayPayload(id: string, amount?: number): string {
  // Strip dashes, spaces, and leading/trailing whitespace
  const sanitized = id.replace(/[-\s]/g, "");

  // Determine ID type and format accordingly
  let accountFieldTag: string;
  let formattedId: string;

  if (/^0\d{9}$/.test(sanitized)) {
    // Thai mobile number: 0x-xxxx-xxxx (10 digits)
    // Convert to international format: 0066 + last 9 digits = 13 digits
    accountFieldTag = "01";
    formattedId = "0066" + sanitized.substring(1).padStart(9, "0");
  } else if (/^\+?66\d{9}$/.test(sanitized)) {
    // Already international format: +66xxxxxxxxx or 66xxxxxxxxx
    accountFieldTag = "01";
    const digits = sanitized.replace(/^\+/, "");
    formattedId = "00" + digits;
  } else if (/^\d{13}$/.test(sanitized)) {
    // National ID or Tax ID (13 digits)
    accountFieldTag = "02";
    formattedId = sanitized;
  } else if (/^\d{15}$/.test(sanitized)) {
    // E-Wallet ID (15 digits)
    accountFieldTag = "03";
    formattedId = sanitized;
  } else {
    throw new Error(
      "Invalid PromptPay ID. Use mobile number (08x-xxx-xxxx), National ID (13 digits), or E-Wallet ID (15 digits).",
    );
  }

  // Build merchant account info (Tag 29)
  const merchantAccountInfo =
    tlv("00", "A000000677010111") + tlv(accountFieldTag, formattedId);

  // Point of initiation: "11" = static, "12" = dynamic (with amount)
  const pointOfInitiation = amount ? "12" : "11";

  // Build payload (without CRC)
  let payload =
    tlv("00", "01") +
    tlv("01", pointOfInitiation) +
    tlv("29", merchantAccountInfo) +
    tlv("53", "764") +
    (amount ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "TH");

  // Add CRC placeholder (tag 63, length 04, value to be calculated)
  payload += "6304";

  // Calculate CRC-16/CCITT-FALSE and append
  const crc = crc16(payload);
  payload += crc;

  return payload;
}

/** Encode a TLV (Tag-Length-Value) field */
function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${tag}${length}${value}`;
}

/**
 * CRC-16/CCITT-FALSE (polynomial 0x1021, init 0xFFFF)
 * Returns 4-character uppercase hex string
 */
function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// ─── Helpers ──────────────────────────────────────────────────────

function escapeWiFiField(value: string): string {
  return value.replace(/([\\;,":])/, "\\$1");
}
