// ─── QR Types ─────────────────────────────────────────────────────

export type QRType =
  | "url"
  | "text"
  | "wifi"
  | "vcard"
  | "email"
  | "phone"
  | "sms"
  | "line"
  | "facebook";

// ─── Content Interfaces (one per QR type) ─────────────────────────

export interface URLContent {
  url: string;
}

export interface TextContent {
  text: string;
}

export interface WiFiContent {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface VCardContent {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  org?: string;
  title?: string;
  url?: string;
}

export interface EmailContent {
  to: string;
  subject?: string;
  body?: string;
}

export interface PhoneContent {
  phone: string;
}

export interface SMSContent {
  phone: string;
  message?: string;
}

export interface LineContent {
  lineId: string;
}

export interface FacebookContent {
  facebookUrl: string;
}

export type QRContent =
  | URLContent
  | TextContent
  | WiFiContent
  | VCardContent
  | EmailContent
  | PhoneContent
  | SMSContent
  | LineContent
  | FacebookContent;

// ─── Border Style ─────────────────────────────────────────────────

export type BorderStyle =
  | "none"
  // Rounded Frames
  | "round-sm"
  | "round-lg"
  | "glow"
  // Decorative
  | "corners"
  | "gradient";

// ─── Style Options ────────────────────────────────────────────────

export interface QRStyle {
  fgColor: string;
  bgColor: string;
  dotStyle: "square" | "rounded" | "dots";
  ecLevel: "L" | "M" | "Q" | "H";
  width: number;
  margin: number;
  labelText?: string;
  labelSize?: number;
  labelColor?: string;
  labelPosition?: "top" | "bottom";
  borderStyle?: BorderStyle;
  borderColor?: string;
}

// ─── History Entry (stored in localStorage) ──────────────────────

export interface HistoryEntry {
  id: string;
  type: QRType;
  content: Record<string, string>;
  style: Partial<QRStyle>;
  label: string;
  starred: boolean;
  createdAt: string;
  source: "generated" | "scanned";
  thumbnail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

const VALID_DOT_STYLES = ["square", "rounded", "dots"] as const;
const VALID_EC_LEVELS = ["L", "M", "Q", "H"] as const;
const VALID_BORDER_STYLES = [
  "none",
  "round-sm",
  "round-lg",
  "glow",
  "corners",
  "gradient",
] as const;

export const VALID_QR_TYPES: QRType[] = [
  "url",
  "text",
  "wifi",
  "vcard",
  "email",
  "phone",
  "sms",
  "line",
  "facebook",
];

export function parseQRStyle(raw: Record<string, unknown>): QRStyle {
  return {
    fgColor: String(raw.fgColor || "#000000"),
    bgColor: String(raw.bgColor || "#ffffff"),
    dotStyle: VALID_DOT_STYLES.includes(raw.dotStyle as any)
      ? (raw.dotStyle as QRStyle["dotStyle"])
      : "square",
    ecLevel: VALID_EC_LEVELS.includes(raw.ecLevel as any)
      ? (raw.ecLevel as QRStyle["ecLevel"])
      : "M",
    width: Number(raw.width) || 512,
    margin: Number(raw.margin) || 2,
    labelText: raw.labelText ? String(raw.labelText).trim() : undefined,
    labelSize: Number(raw.labelSize) || 7,
    labelColor: raw.labelColor ? String(raw.labelColor) : undefined,
    labelPosition: raw.labelPosition === "top" ? "top" : "bottom",
    borderStyle: VALID_BORDER_STYLES.includes(raw.borderStyle as any)
      ? (raw.borderStyle as BorderStyle)
      : "none",
    borderColor: raw.borderColor ? String(raw.borderColor) : undefined,
  };
}
