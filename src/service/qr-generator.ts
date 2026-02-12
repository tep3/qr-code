import QRCode from "qrcode";
import sharp from "sharp";
import { join } from "path";
import type { QRStyle, BorderStyle } from "../type";

/**
 * Generate a QR code image (PNG or SVG).
 *
 * Pipeline: QR modules → Logo → Label → Border → output
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

  // Logo logic removed

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
  let svgString = "";

  // 1. Generate Base QR SVG
  if (!style.dotStyle || style.dotStyle === "square") {
    svgString = await QRCode.toString(data, {
      ...options,
      type: "svg",
    });
  } else {
    svgString = await generateStyledSVGString(data, style);
  }

  // 2. Add Label (Bottom/Top)
  if (style.labelText) {
    svgString = addLabelToSVG(svgString, style.labelText, style, transparentBg);
  }

  // 3. Add Border (Surrounding)
  if (style.borderStyle && style.borderStyle !== "none") {
    svgString = addBorderToSVG(svgString, style, transparentBg);
  }

  // 4. Finalize Dimensions & Background
  svgString = setSvgDimensions(
    svgString,
    style.width,
    style.bgColor,
    transparentBg,
  );

  return new TextEncoder().encode(svgString);
}

// --- Custom Renderer for Dots/Rounded ----------------------------

async function generateStyledSVGString(
  data: string,
  style: QRStyle,
): Promise<string> {
  const qr = QRCode.create(data, {
    errorCorrectionLevel: style.ecLevel as any,
  });

  const modules = qr.modules;
  const size = modules.size;
  const margin = style.margin;
  const totalSize = size + margin * 2;

  let pathParts: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules.data[r * size + c]) {
        const x = c + margin;
        const y = r + margin;

        // เช็คว่าเป็น Finder Patterns (3 มุมหลัก) หรือไม่?
        // Top-Left (0,0 ถึง 6,6)
        // Top-Right (0,size-7 ถึง 6,size-1)
        // Bottom-Left (size-7,0 ถึง size-1,6)
        const isFinderPattern =
          (r < 7 && c < 7) ||
          (r < 7 && c >= size - 7) ||
          (r >= size - 7 && c < 7);

        if (isFinderPattern) {
          // *** สำคัญ: Finder Pattern ต้องเป็นสี่เหลี่ยมเสมอเพื่อให้สแกนติดง่าย ***
          pathParts.push(`<rect x="${x}" y="${y}" width="1" height="1" />`);
        } else {
          // ส่วนที่เป็น Data อื่นๆ ให้วาดตาม Style ที่เลือก
          if (style.dotStyle === "dots") {
            pathParts.push(
              `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.45" />`,
            );
          } else if (style.dotStyle === "rounded") {
            pathParts.push(
              `<rect x="${x}" y="${y}" width="1" height="1" rx="0.35" ry="0.35" />`,
            );
          } else {
            pathParts.push(`<rect x="${x}" y="${y}" width="1" height="1" />`);
          }
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}">
    <g fill="${style.fgColor}">
      ${pathParts.join("")}
    </g>
  </svg>`;
}

// --- PNG Generation ----------------------------------------------

async function generatePNG(
  data: string,
  options: Record<string, unknown>,
  style: QRStyle,
): Promise<Uint8Array> {
  const hasOverlays = !!(
    style.labelText ||
    (style.borderStyle && style.borderStyle !== "none") ||
    (style.dotStyle && style.dotStyle !== "square")
  );

  if (hasOverlays) {
    const transparentOptions = {
      ...options,
      color: {
        ...(options.color as Record<string, string>),
        light: "#00000000",
      },
    };
    const svgBuffer = await generateSVG(data, transparentOptions, style, true);

    const pngBuffer = await sharp(Buffer.from(svgBuffer))
      .resize(style.width)
      .flatten({ background: style.bgColor })
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
  const fontSize = width * (sizePercent / 100);
  const fontColor = style.labelColor || style.fgColor;

  const gap = fontSize * 0.8;
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
      x="${minX + width / 2}"
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

  const viewBoxMatch = svgString.match(/viewBox=["']?([\d\s,\.-]+)["']?/i);
  if (!viewBoxMatch) return svgString;

  const vbParts = viewBoxMatch[1].trim().split(/[\s,]+/);
  const vbX = parseFloat(vbParts[0]);
  const vbY = parseFloat(vbParts[1]);
  const vbW = parseFloat(vbParts[2]);
  const vbH = parseFloat(vbParts[3]);

  const borderColor = style.borderColor || style.fgColor;
  const strokeW = vbW * 0.02;
  const pad = vbW * 0.06;

  const totalW = vbW + pad * 2;
  const totalH = vbH + pad * 2;
  const newViewBox = `0 0 ${totalW} ${totalH}`;

  const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!innerMatch) return svgString;
  const innerContent = innerMatch[1];

  let defs = "";
  let borderElements = "";
  const inset = strokeW / 2;

  switch (border) {
    case "round-sm": {
      const rx = totalW * 0.05;
      borderElements = `<rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}" rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" />`;
      break;
    }
    case "round-lg": {
      const rx = totalW * 0.12;
      borderElements = `<rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}" rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" />`;
      break;
    }
    case "glow": {
      const rx = totalW * 0.08;
      const filterId = "qr-glow";
      defs = `<defs><filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="${strokeW * 2}" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>`;
      borderElements = `<rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}" rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" filter="url(#${filterId})" opacity="0.7" /><rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}" rx="${rx}" ry="${rx}" fill="none" stroke="${borderColor}" stroke-width="${Math.max(1, strokeW * 0.5)}" />`;
      break;
    }
    case "corners": {
      const cornerLen = totalW * 0.15;
      const tl = `M ${inset} ${inset + cornerLen} L ${inset} ${inset} L ${inset + cornerLen} ${inset}`;
      const tr = `M ${totalW - inset - cornerLen} ${inset} L ${totalW - inset} ${inset} L ${totalW - inset} ${inset + cornerLen}`;
      const bl = `M ${inset} ${totalH - inset - cornerLen} L ${inset} ${totalH - inset} L ${inset + cornerLen} ${totalH - inset}`;
      const br = `M ${totalW - inset - cornerLen} ${totalH - inset} L ${totalW - inset} ${totalH - inset} L ${totalW - inset} ${totalH - inset - cornerLen}`;
      borderElements = `<path d="${tl}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" /><path d="${tr}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" /><path d="${bl}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" /><path d="${br}" fill="none" stroke="${borderColor}" stroke-width="${strokeW}" stroke-linecap="round" />`;
      break;
    }
    case "gradient": {
      const rx = totalW * 0.06;
      const gradId = "qr-border-grad";
      defs = `<defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff6b6b" /><stop offset="33%" stop-color="#ffd93d" /><stop offset="66%" stop-color="#00e5a0" /><stop offset="100%" stop-color="#6c63ff" /></linearGradient></defs>`;
      borderElements = `<rect x="${inset}" y="${inset}" width="${totalW - strokeW}" height="${totalH - strokeW}" rx="${rx}" ry="${rx}" fill="none" stroke="url(#${gradId})" stroke-width="${strokeW * 1.5}" />`;
      break;
    }
  }

  return assembleSVG(
    newViewBox,
    defs,
    borderElements,
    `<g transform="translate(${pad - vbX}, ${pad - vbY})">${innerContent}</g>`,
  );
}

// --- Helpers -----------------------------------------------------

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

  const targetHeight = Math.round(targetWidth * (vbH / vbW));

  let bgRect = "";
  if (!transparentBg) {
    bgRect = `<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgColor}" />`;
  }

  return svgString.replace(/<svg([^>]+)>/i, (_, attrs) => {
    const cleanAttrs = attrs.replace(/\b(?:width|height)=["'][^"']*["']/gi, "");
    return `<svg width="${targetWidth}" height="${targetHeight}"${cleanAttrs}>${bgRect}`;
  });
}

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

function extractSvgDetails(svgString: string): {
  content: string;
  viewBox: string;
} {
  const viewBoxMatch = svgString.match(/viewBox=["']?([\d\s,\.-]+)["']?/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";

  const contentMatch = svgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  let content = contentMatch ? contentMatch[1].trim() : "";

  if (!content && svgString.includes("<path")) {
    const start = svgString.indexOf(">");
    const end = svgString.lastIndexOf("</svg>");
    if (start > -1 && end > -1) {
      content = svgString.substring(start + 1, end).trim();
    }
  }

  return { content, viewBox };
}

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
