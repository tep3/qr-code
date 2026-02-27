// ==========================================
// QR Forge - Global Application JavaScript
// ==========================================

/**
 * Toast Notification System
 * Global notification system for all pages
 */
const ToastSystem = {
  container: null,

  init() {
    this.container = document.getElementById("toast-container");
    if (!this.container) {
      console.warn("Toast container not found");
      return false;
    }
    return true;
  },

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type: 'success' | 'error' | 'warning' | 'info'
   * @param {number} duration - Duration in milliseconds (default: 4000)
   */
  show(message, type = "success", duration = 4000) {
    if (!this.container && !this.init()) return;

    // Type configurations
    const configs = {
      success: {
        bg: "bg-success/10",
        border: "border-success/20",
        icon: "text-success",
        iconSvg:
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />',
        progress: "bg-success/30",
      },
      error: {
        bg: "bg-error/10",
        border: "border-error/20",
        icon: "text-error",
        iconSvg:
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />',
        progress: "bg-error/30",
      },
      warning: {
        bg: "bg-warning/10",
        border: "border-warning/20",
        icon: "text-warning",
        iconSvg:
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />',
        progress: "bg-warning/30",
      },
      info: {
        bg: "bg-info/10",
        border: "border-info/20",
        icon: "text-info",
        iconSvg:
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
        progress: "bg-info/30",
      },
    };

    const config = configs[type] || configs.success;

    // Create toast element
    const toast = document.createElement("div");
    toast.className = `toast-notification relative overflow-hidden rounded-2xl shadow-2xl border backdrop-blur-md ${config.bg} ${config.border}`;

    toast.innerHTML = `
      <div class="flex items-start gap-4 p-4">
        <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-base-100/80 flex items-center justify-center ${config.icon} shadow-sm">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${config.iconSvg}
          </svg>
        </div>
        <div class="flex-1 min-w-0 pt-1">
          <p class="text-sm font-medium text-base-content leading-relaxed">${message}</p>
        </div>
        <button class="close-toast flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base-content/40 hover:text-base-content hover:bg-base-200/50 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="progress-bar h-1 ${config.progress}" style="animation-duration: ${duration}ms;"></div>
    `;

    // Add close functionality
    const closeBtn = toast.querySelector(".close-toast");
    let autoRemoveTimer;

    const hideToast = () => {
      toast.classList.add("hiding");
      setTimeout(() => toast.remove(), 300);
    };

    closeBtn.addEventListener("click", () => {
      clearTimeout(autoRemoveTimer);
      hideToast();
    });

    // Pause on hover
    const progressBar = toast.querySelector(".progress-bar");
    toast.addEventListener("mouseenter", () => {
      progressBar.style.animationPlayState = "paused";
      clearTimeout(autoRemoveTimer);
    });

    toast.addEventListener("mouseleave", () => {
      progressBar.style.animationPlayState = "running";
      autoRemoveTimer = setTimeout(hideToast, duration);
    });

    // Auto remove after duration
    autoRemoveTimer = setTimeout(hideToast, duration);

    // Add to container
    this.container.appendChild(toast);

    // Limit to 3 toasts max
    const toasts = this.container.querySelectorAll(".toast-notification");
    if (toasts.length > 3) {
      toasts[0].remove();
    }
  },

  // Shorthand methods
  success(message, duration) {
    this.show(message, "success", duration);
  },
  error(message, duration) {
    this.show(message, "error", duration);
  },
  warning(message, duration) {
    this.show(message, "warning", duration);
  },
  info(message, duration) {
    this.show(message, "info", duration);
  },
};

// Global showToast function for backward compatibility
window.showToast = function (message, type = "success", duration = 4000) {
  ToastSystem.show(message, type, duration);
};

// ==========================================
// Global Functions: Download QR & Save to History
// ==========================================

/**
 * Collect all form data from #qr-form as flat key=value pairs
 */
function collectFormData() {
  const form = document.getElementById("qr-form");
  if (!form) return {};
  const fd = new FormData(form);
  const data = {};
  for (const [key, value] of fd.entries()) {
    data[key] = value;
  }
  return data;
}

/**
 * Download QR code as PNG or SVG
 */
function downloadQR(format) {
  const data = collectFormData();
  data.format = format || "png";

  const params = new URLSearchParams();
  for (const key in data) {
    if (data[key] !== undefined && data[key] !== "") {
      params.set(key, String(data[key]));
    }
  }

  const url = "/api/qr/download?" + params.toString();
  const ext = format === "svg" ? "svg" : "png";
  const filename = "qr-forge-" + Date.now() + "." + ext;
  const mimeType = format === "svg" ? "image/svg+xml" : "image/png";

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("Server error " + res.status);
      return res.blob();
    })
    .then((blob) => {
      // Try Web Share API first
      try {
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "QR Code" }).catch(() => {
            blobDownload(blob, filename);
          });
          return;
        }
      } catch (e) {
        // Fallback
      }
      blobDownload(blob, filename);
    })
    .catch((err) => {
      console.error("Download failed:", err);
      window.open(url, "_blank");
    });
}

/** Fallback download via blob URL */
function blobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
}

/**
 * Save current QR code to localStorage history
 */
function saveToHistory() {
  const STORAGE_KEY = "qrforge_history";
  const MAX_HISTORY = 50;
  const THUMB_SIZE = 128;

  try {
    const data = collectFormData();
    const type = data.type || "text";

    // Extract content fields
    const content = {};
    for (const key in data) {
      if (key.startsWith("content.") && data[key]) {
        content[key.replace("content.", "")] = data[key];
      }
    }

    // Extract style fields
    const style = {};
    for (const key in data) {
      if (key.startsWith("style.") && data[key]) {
        style[key.replace("style.", "")] = data[key];
      }
    }

    // Generate label
    let label = "";
    const labelMap = {
      url: () => content.url || "URL",
      text: () => content.text || "Text",
      wifi: () => content.ssid || "WiFi",
      vcard: () =>
        [content.firstName, content.lastName].filter(Boolean).join(" ") ||
        "Contact",
      email: () => content.to || "Email",
      phone: () => content.phone || "Phone",
      sms: () => content.phone || "SMS",
      line: () => content.lineId || "LINE",
      facebook: () => content.facebookUrl || "Facebook",
      promptpay: () => content.promptpayId || "PromptPay",
    };

    label = (labelMap[type] || (() => "QR Code"))();
    if (label.length > 50) label = label.substring(0, 50) + "...";

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      type,
      content,
      style,
      label,
      starred: false,
      createdAt: new Date().toISOString(),
      source: "generated",
      thumbnail: "",
    };

    function persistEntry(thumbData) {
      entry.thumbnail = thumbData || "";
      try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        history.unshift(entry);
        if (history.length > MAX_HISTORY) history.pop();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        updateHistoryBadges(history.length);
        ToastSystem.success(window.t ? window.t("saved") : "Saved!", 2000);
      } catch (storageErr) {
        console.error("localStorage save failed:", storageErr);
        if (thumbData) {
          entry.thumbnail = "";
          try {
            const h2 = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            h2.unshift(entry);
            if (h2.length > MAX_HISTORY) h2.pop();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(h2));
            updateHistoryBadges(h2.length);
          } catch (e2) {
            ToastSystem.error("Failed to save to history");
          }
        }
      }
    }

    // Generate thumbnail
    const previewImg = document.querySelector("#qr-preview img");
    const srcDataUrl = previewImg?.src?.startsWith("data:")
      ? previewImg.src
      : "";

    if (srcDataUrl) {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = THUMB_SIZE;
          canvas.height = THUMB_SIZE;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
          ctx.drawImage(img, 0, 0, THUMB_SIZE, THUMB_SIZE);
          persistEntry(canvas.toDataURL("image/png", 0.6));
        } catch (canvasErr) {
          console.warn("Canvas thumbnail failed:", canvasErr);
          persistEntry("");
        }
      };
      img.onerror = () => persistEntry("");
      img.src = srcDataUrl;
    } else {
      persistEntry("");
    }

    showSaveButtonFeedback();
  } catch (e) {
    console.error("Failed to save to history", e);
    ToastSystem.error("Failed to save");
  }
}

function showSaveButtonFeedback() {
  const saveBtn = document.getElementById("save-to-history-btn");
  if (!saveBtn) return;
  const originalHTML = saveBtn.innerHTML;
  saveBtn.innerHTML = "✅ " + (window.t ? window.t("saved") : "Saved!");
  saveBtn.classList.add("btn-success", "text-white");
  saveBtn.classList.remove("btn-ghost", "text-base-content/50");
  saveBtn.disabled = true;
  setTimeout(() => {
    saveBtn.innerHTML = originalHTML;
    saveBtn.classList.remove("btn-success", "text-white");
    saveBtn.classList.add("btn-ghost", "text-base-content/50");
    saveBtn.disabled = false;
  }, 2000);
}

function updateHistoryBadges(count) {
  ["history-badge", "history-badge-mobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = count;
      if (count > 0) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
  });
}

// ==========================================
// Main DOMContentLoaded Setup
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Toast System
  ToastSystem.init();

  // ==========================================
  // 1. Dropdown Toggle
  // ==========================================
  const setupDropdowns = () => {
    const toggleBtns = document.querySelectorAll("[data-dropdown-toggle]");

    toggleBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute("data-dropdown-toggle");
        const targetMenu = document.getElementById(targetId);

        if (targetMenu) {
          document
            .querySelectorAll(".dropdown-menu-content")
            .forEach((menu) => {
              if (menu.id !== targetId && !menu.classList.contains("hidden")) {
                menu.classList.add("hidden");
              }
            });
          targetMenu.classList.toggle("hidden");
        }
      });
    });

    const handleGlobalClick = (e) => {
      document
        .querySelectorAll(".dropdown-menu-content:not(.hidden)")
        .forEach((menu) => {
          const toggleBtn = document.querySelector(
            `[data-dropdown-toggle="${menu.id}"]`,
          );
          const isClickOnMenuItem = e.target.closest("li, a, button");

          if (menu.contains(e.target) && isClickOnMenuItem) {
            menu.classList.add("hidden");
            return;
          }
          if (
            !menu.contains(e.target) &&
            toggleBtn &&
            !toggleBtn.contains(e.target)
          ) {
            menu.classList.add("hidden");
          }
        });
    };

    document.addEventListener("click", handleGlobalClick);
    document.addEventListener("touchstart", handleGlobalClick, {
      passive: true,
    });
  };

  // ==========================================
  // 2. Mobile Menu
  // ==========================================
  const setupMobileMenu = () => {
    const mobileBtn = document.getElementById("mobile-menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle("hidden");
      });

      ["click", "touchstart"].forEach((eventType) => {
        document.addEventListener(eventType, (e) => {
          if (
            !mobileMenu.classList.contains("hidden") &&
            !mobileBtn.contains(e.target) &&
            !mobileMenu.contains(e.target)
          ) {
            mobileMenu.classList.add("hidden");
          }
        });
      });
    }
  };

  // ==========================================
  // 3. Tabs
  // ==========================================
  const setupTabs = () => {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach((b) => {
          b.classList.remove("active", "border-blue-500", "text-blue-600");
          b.classList.add("border-transparent", "text-gray-500");
        });
        tabContents.forEach((content) => content.classList.add("hidden"));

        const targetId = btn.getAttribute("data-tab-target");
        const targetContent = document.getElementById(targetId);

        btn.classList.add("active", "border-blue-500", "text-blue-600");
        btn.classList.remove("border-transparent", "text-gray-500");
        targetContent?.classList.remove("hidden");
      });
    });
  };

  // ==========================================
  // 4. Form Submit
  // ==========================================
  const setupForms = () => {
    const forms = document.querySelectorAll("form[data-qr-form]");
    const qrResultContainer = document.getElementById("qr-result-container");
    const qrImage = document.getElementById("qr-image");

    forms.forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.type = form.getAttribute("data-qr-type");

        try {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            const result = await response.json();
            if (qrImage && result.qrImageUrl) {
              qrImage.src = result.qrImageUrl;
              qrResultContainer?.classList.remove("hidden");
            }
          } else {
            ToastSystem.error("Failed to generate QR Code");
          }
        } catch (error) {
          console.error("Error:", error);
          ToastSystem.error("Network error. Please try again.");
        }
      });
    });
  };

  setupDropdowns();
  setupMobileMenu();
  setupTabs();
  setupForms();
});
