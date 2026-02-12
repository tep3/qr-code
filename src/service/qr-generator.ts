import QRCode from "qrcode";
import sharp from "sharp";
import { join } from "path";
import type { QRStyle, BorderStyle } from "../type";

/**
 * Generate a QR code image (PNG or SVG).
 *
 * Pipeline: QR modules → Label → Border → output
 * PNG with overlays uses SVG → sharp conversion (transparent bg).
 */
export async function generateQR(
  data: string,
  style: QRStyle,
  format: "png" | "svg" = "png",
): Promise<Uint8Array> {
  if (!data || data.trim().length === 0) {
    throw new Error("QR content cannot be empty");
  }

  const ecMap: Record<string, "low" | "medium" | "quartile" | "high"> = {
    L: "low",
    M: "medium",
    Q: "quartile",
    H: "high",
  };

  const baseOptions = {
    errorCorrectionLevel: ecMap[style.ecLevel] || "medium",
    margin: style.margin,
    width: style.width,
    color: {
      dark: style.fgColor,
      light: style.bgColor,
    },
  };

  if (format === "svg") {
    return generateSVG(data, baseOptions, style);
  }

  return generatePNG(data, baseOptions, style);
}

// --- SVG Generation ----------------------------------------------

async function generateSVG(
  data: string,
  options: Record<string, unknown>,
  style: QRStyle,
  transparentBg: boolean = false,
): Promise<Uint8Array> {
  let svgString = await QRCode.toString(data, {
    ...options,
    type: "svg",
  });

  if (style.labelText) {
    svgString = addLabelToSVG(svgString, style.labelText, style, transparentBg);
  }

  // Border is always the LAST step — wraps everything
  if (style.borderStyle && style.borderStyle !== "none") {
    svgString = addBorderToSVG(svgString, style, transparentBg);
  }

  svgString = setSvgDimensions(
    svgString,
    style.width,
    style.bgColor,
    transparentBg,
  );

  return new TextEncoder().encode(svgString);
}

// --- PNG Generation ----------------------------------------------

async function generatePNG(
  data: string,
  options: Record<string, unknown>,
  style: QRStyle,
): Promise<Uint8Array> {
  const hasOverlays = !!(
    style.labelText ||
    (style.borderStyle && style.borderStyle !== "none")
  );

  if (hasOverlays) {
    // สร้าง SVG แบบพื้นทึบเพื่อนำมาแปลงเป็น PNG (ไม่ส่ง transparentOptions แล้ว)
    const svgBuffer = await generateSVG(data, options, style, false);
    const pngBuffer = await sharp(Buffer.from(svgBuffer))
      .resize(style.width)
      .flatten({ background: style.bgColor }) // บังคับเทสีพื้นหลังทับเพื่อรับประกันความทึบ
      .png()
      .toBuffer();
    return new Uint8Array(pngBuffer);
  }

  const pngBuffer = await QRCode.toBuffer(data, {
    ...options,
    type: "png",
  });

  return new Uint8Array(pngBuffer);
}

// --- Feature: Label Text -----------------------------------------

function addLabelToSVG(
  svgString: string,
  text: string,
  style: QRStyle,
  transparentBg: boolean = false,
): string {
  const viewBoxMatch = svgString.match(/viewBox=["']?([\d\s,\.-]+)["']?/i);
  if (!viewBoxMatch) return svgString;

  const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
  const minX = parseFloat(parts[0]);
  const minY = parseFloat(parts[1]);
  const width = parseFloat(parts[2]);
  const height = parseFloat(parts[3]);

  const sizePercent = style.labelSize || 7;
  const fontSize = Math.round(width * (sizePercent / 100));
  const fontColor = style.labelColor || style.fgColor;

  const gap = Math.round(fontSize * 0.8);
  const extraHeight = gap + fontSize + gap;

  let newViewBox = "";
  let textY = 0;

  if (style.labelPosition === "top") {
    newViewBox = `${minX} ${minY - extraHeight} ${width} ${height + extraHeight}`;
    textY = minY - gap - fontSize / 3;
  } else {
    newViewBox = `${minX} ${minY} ${width} ${height + extraHeight}`;
    textY = height + gap + fontSize / 2;
  }

  let labelBgRect = "";
  if (!transparentBg) {
    if (style.labelPosition === "top") {
      labelBgRect = `<rect x="${minX}" y="${minY - extraHeight}" width="${width}" height="${extraHeight}" fill="${style.bgColor}" />`;
    } else {
      labelBgRect = `<rect x="${minX}" y="${height}" width="${width}" height="${extraHeight}" fill="${style.bgColor}" />`;
    }
  }

  const textElement = `
    ${labelBgRect}
    <text
      x="${width / 2}"
      y="${textY}"
      font-family="sans-serif"
      font-size="${fontSize}"
      font-weight="bold"
      fill="${fontColor}"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      ${escapeXml(text)}
    </text>
  `;

  return svgString
    .replace(viewBoxMatch[0], `viewBox="${newViewBox}"`)
    .replace("</svg>", `${textElement}\n</svg>`);
}

// --- Feature: Border / Frame -------------------------------------

function addBorderToSVG(
  svgString: string,
  style: QRStyle,
  transparentBg: boolean = false,
): string {
  const border = style.borderStyle || "none";
  if (border === "none") return svgString;

  // 1. Parse current viewBox
  const viewBoxMatch = svgString.match(/viewBox=["']?([\d\s,\.-]+)["']?/i);
  if (!viewBoxMatch) return svgString;

  const vbParts = viewBoxMatch[1].trim().split(/[\s,]+/);
  const vbX = parseFloat(vbParts[0]);
  const vbY = parseFloat(vbParts[1]);
  const vbW = parseFloat(vbParts[2]);
  const vbH = parseFloat(vbParts[3]);

  const borderColor = style.borderColor || style.fgColor;
  const strokeW = Math.round(vbW * 0.02); // 2% of width
  const pad = Math.round(vbW * 0.06); // 6% padding around content

  // 2. New dimensions (content shifted by pad)
  const totalW = vbW + pad * 2;
  const totalH = vbH + pad * 2;
  const newViewBox = `0 0 ${totalW} ${totalH}`;

  // 3. Extract inner content
  const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!innerMatch) return svgString;
  const innerContent = innerMatch[1];

  // 4. Build border elements based on style
  let defs = "";
  let borderElements = "";

  // Inset for stroke (half stroke sits outside)
  const inset = strokeW / 2;

  switch (border) {
    // ── Rounded Frames ──────────────────────────────
    case "round-sm": {
      const rx = Math.round(totalW * 0.05);
      borderElements = `
        <rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}"
          rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" />
      `;
      break;
    }

    case "round-lg": {
      const rx = Math.round(totalW * 0.12);
      borderElements = `
        <rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}"
          rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" />
      `;
      break;
    }

    case "glow": {
      const rx = Math.round(totalW * 0.08);
      const filterId = "qr-glow";
      defs = `
        <defs>
          <filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="${strokeW * 2}" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      `;
      borderElements = `
        <rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}"
          rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}"
          filter="url(#${filterId})" opacity="0.7" />
        <rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}"
          rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${Math.max(1, strokeW * 0.5)}" />
      `;
      break;
    }

    // ── Decorative ──────────────────────────────────
    case "corners": {
      const cornerLen = Math.round(totalW * 0.15);
      // Top-left
      const tl = `M ${inset} ${inset + cornerLen} L ${inset} ${inset} L ${inset + cornerLen} ${inset}`;
      // Top-right
      const tr = `M ${totalW - inset - cornerLen} ${inset} L ${totalW - inset} ${inset} L ${totalW - inset} ${inset + cornerLen}`;
      // Bottom-left
      const bl = `M ${inset} ${totalH - inset - cornerLen} L ${inset} ${totalH - inset} L ${inset + cornerLen} ${totalH - inset}`;
      // Bottom-right
      const br = `M ${totalW - inset - cornerLen} ${totalH - inset} L ${totalW - inset} ${totalH - inset} L ${totalW - inset} ${totalH - inset - cornerLen}`;

      borderElements = `
        <path d="${tl}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" />
        <path d="${tr}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" />
        <path d="${bl}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" />
        <path d="${br}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" />
      `;
      break;
    }

    case "gradient": {
      const rx = Math.round(totalW * 0.06);
      const gradId = "qr-border-grad";
      defs = `
        <defs>
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ff6b6b" />
            <stop offset="33%" stop-color="#ffd93d" />
            <stop offset="66%" stop-color="#00e5a0" />
            <stop offset="100%" stop-color="#6c63ff" />
          </linearGradient>
        </defs>
      `;
      borderElements = `
        <rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}"
          rx="${rx}" ry="${rx}" fill="none" stroke="url(#${gradId})" stroke-width="${strokeW * 1.5}" />
      `;
      break;
    }

    default:
      return svgString;
  }

  // 5. Assemble final SVG (for non-special layouts)
  return assembleSVG(
    newViewBox,
    defs,
    borderElements,
    `<g transform="translate(${pad - vbX}, ${pad - vbY})">${innerContent}</g>`,
  );
}

/** Assemble a complete SVG string */
function assembleSVG(
  viewBox: string,
  defs: string,
  borderElements: string,
  content: string,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${defs}
${borderElements}
${content}
</svg>`;
}

// --- Helpers -----------------------------------------------------

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
    }
    return c;
  });
}

function setSvgDimensions(
  svgString: string,
  targetWidth: number,
  bgColor: string,
  transparentBg: boolean,
): string {
  const viewBoxMatch = svgString.match(/viewBox=["']?([\d\s,\.-]+)["']?/i);
  if (!viewBoxMatch) return svgString;

  const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
  const vbX = parseFloat(parts[0]) || 0;
  const vbY = parseFloat(parts[1]) || 0;
  const vbW = parseFloat(parts[2]);
  const vbH = parseFloat(parts[3]);

  // คำนวณความสูงให้ได้สัดส่วนที่ถูกต้องตาม viewBox
  const targetHeight = Math.round(targetWidth * (vbH / vbW));

  let bgRect = "";
  if (!transparentBg) {
    // สร้างกรอบสี่เหลี่ยมสีทึบขนาดเท่า viewBox ทั้งหมด ไว้ด้านหลังสุด (ครอบคลุมความโปร่งใสทั้งหมด)
    bgRect = `\n  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgColor}" />`;
  }

  // ลบ width/height เดิมออก และบังคับใส่ค่า pixel size ที่ชัดเจนลงไป พร้อมแทรก bgRect
  return svgString.replace(/<svg([^>]+)>/i, (_, attrs) => {
    const cleanAttrs = attrs.replace(/\b(?:width|height)=["'][^"']*["']/gi, "");
    return `<svg width="${targetWidth}" height="${targetHeight}"${cleanAttrs}>${bgRect}`;
  });
}
