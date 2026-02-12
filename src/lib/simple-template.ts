/**
 * SimpleTemplate  -- Lightweight HTML template engine for QR Forge
 *
 * Uses {{variable}} placeholders in .html files.
 * - renderPage()     -> wraps page content inside layout.html (full page)
 * - renderPartial()  -> returns HTML fragment only (for HTMX swaps)
 *
 * File structure expected:
 *   public/templates/layout.html        -> base layout with {{content}}, {{title}}, etc.
 *   public/pages/{pageName}.html        -> full page content
 *   public/partials/{partialName}.html  -> HTMX fragments (no layout wrapper)
 */

// Cache for loaded template files (avoids re-reading from disk on every request)
const templateCache = new Map<string, string>();

export class SimpleTemplate {
  /**
   * Escape HTML special characters to prevent XSS
   * Use this when injecting any user-provided data into templates
   */
  static escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Load a template file from disk (with optional caching)
   */
  private static async loadFile(filePath: string): Promise<string> {
    const cached = templateCache.get(filePath);
    if (cached) return cached;

    console.log("Loading file:", filePath);

    const content = await Bun.file(filePath).text();

    // Cache in production, skip in development for hot-reload
    if (process.env.NODE_ENV === "production") {
      templateCache.set(filePath, content);
    }

    return content;
  }

  /**
   * Replace all {{key}} placeholders in a template string
   *
   * - Values in `data` are inserted as-is (raw HTML allowed)
   * - Values in `escapeKeys` will be HTML-escaped before insertion
   */
  private static replacePlaceholders(
    template: string,
    data: Record<string, unknown>,
    escapeKeys: string[] = [],
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      let strValue = String(value ?? "");

      if (escapeKeys.includes(key)) {
        strValue = SimpleTemplate.escapeHtml(strValue);
      }

      result = result.replace(regex, strValue);
    }

    // Clean up any remaining unreplaced placeholders
    result = result.replace(/\{\{[a-zA-Z_][a-zA-Z0-9_.]*\}\}/g, "");

    return result;
  }

  /**
   * Render a full page wrapped in the base layout
   *
   * @param pageName  - File name (without .html) in public/pages/
   * @param data      - Template variables (must include `title`)
   * @param escapeKeys - Keys whose values should be HTML-escaped
   *
   * @example
   *   const html = await SimpleTemplate.renderPage("home", {
   *     title: "Generate QR Code",
   *     activePage: "generate",
   *   });
   */
  static async renderPage(
    pageName: string,
    data: { title: string; [key: string]: unknown },
    escapeKeys: string[] = [],
  ): Promise<string> {
    const layout = await SimpleTemplate.loadFile(
      "./public/template/layout.html",
    );
    const pageContent = await SimpleTemplate.loadFile(
      `./public/page/${pageName}.html`,
    );

    // First: replace variables inside the page content
    const processedPageContent = SimpleTemplate.replacePlaceholders(
      pageContent,
      data,
      escapeKeys,
    );

    // Second: inject page content into layout's {{content}} slot
    const withContent = layout.replace("{{content}}", processedPageContent);

    // Third: replace remaining variables in the full layout (e.g. {{title}})
    const finalHtml = SimpleTemplate.replacePlaceholders(
      withContent,
      data,
      escapeKeys,
    );

    return finalHtml;
  }

  /**
   * Render an HTML fragment (no layout wrapper)  -- used for HTMX partial swaps
   *
   * @param partialName - File name (without .html) in public/partials/
   * @param data        - Template variables
   * @param escapeKeys  - Keys whose values should be HTML-escaped
   *
   * @example
   *   // HTMX route: GET /partials/qr-form/url
   *   const html = await SimpleTemplate.renderPartial("qr-form-url", {
   *     placeholder: "https://example.com",
   *   });
   */
  static async renderPartial(
    partialName: string,
    data: Record<string, unknown> = {},
    escapeKeys: string[] = [],
  ): Promise<string> {
    const content = await SimpleTemplate.loadFile(
      `./public/partials/${partialName}.html`,
    );

    return SimpleTemplate.replacePlaceholders(content, data, escapeKeys);
  }

  /**
   * Render a raw template string (not from a file) with variable replacement
   * Useful for small inline templates or dynamic HTML generation
   *
   * @example
   *   const html = SimpleTemplate.renderString(
   *     `<img src="{{src}}" alt="{{alt}}" />`,
   *     { src: dataUrl, alt: "QR Code" },
   *   );
   */
  static renderString(
    template: string,
    data: Record<string, unknown> = {},
    escapeKeys: string[] = [],
  ): string {
    return SimpleTemplate.replacePlaceholders(template, data, escapeKeys);
  }

  /**
   * Clear the template cache (useful for development/testing)
   */
  static clearCache(): void {
    templateCache.clear();
  }
}
