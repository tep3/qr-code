// ==========================================
// Global Functions: Download QR & Save to History
// (Called from onclick handlers in server-rendered preview HTML)
// ==========================================

/**
 * Collect all form data from #qr-form as flat key=value pairs
 */
function collectFormData() {
  var form = document.getElementById("qr-form");
  if (!form) return {};
  var fd = new FormData(form);
  var data = {};
  for (var pair of fd.entries()) {
    data[pair[0]] = pair[1];
  }
  return data;
}

/**
 * Download QR code as PNG or SVG
 *
 * Capacitor / WKWebView compatible:
 *  1. Web Share API  → native share sheet (Save Image on iOS)
 *  2. Fallback: blob URL + <a download> (desktop browsers)
 *  3. Last resort: window.open
 */
function downloadQR(format) {
  var data = collectFormData();
  data.format = format || "png";

  var params = new URLSearchParams();
  for (var key in data) {
    if (data[key] !== undefined && data[key] !== "") {
      params.set(key, String(data[key]));
    }
  }

  var url = "/api/qr/download?" + params.toString();
  var ext = format === "svg" ? "svg" : "png";
  var filename = "qr-forge-" + Date.now() + "." + ext;
  var mimeType = format === "svg" ? "image/svg+xml" : "image/png";

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error("Server error " + res.status);
      return res.blob();
    })
    .then(function (blob) {
      // 1) Try Web Share API — works on iOS/iPad/Android Capacitor
      try {
        var file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator
            .share({ files: [file], title: "QR Code" })
            .catch(function () {
              // User cancelled share sheet — try fallback
              blobDownload(blob, filename);
            });
          return;
        }
      } catch (e) {
        // File constructor or canShare not supported
      }

      // 2) Fallback: blob object URL + <a download>
      blobDownload(blob, filename);
    })
    .catch(function (err) {
      console.error("Download failed:", err);
      // 3) Last resort
      window.open(url, "_blank");
    });
}

/** Fallback download via blob URL + hidden <a> */
function blobDownload(blob, filename) {
  var blobUrl = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () {
    URL.revokeObjectURL(blobUrl);
  }, 3000);
}

/**
 * Save current QR code to localStorage history.
 *
 * Creates a 128x128 thumbnail via off-screen Image + canvas
 * to keep localStorage usage small (~2-5 KB per entry instead of 100-500 KB).
 */
function saveToHistory() {
  var STORAGE_KEY = "qrforge_history";
  var MAX_HISTORY = 50;
  var THUMB_SIZE = 128;

  try {
    var data = collectFormData();
    var type = data.type || "text";

    // Extract content fields (strip "content." prefix)
    var content = {};
    for (var key in data) {
      if (key.indexOf("content.") === 0 && data[key]) {
        content[key.replace("content.", "")] = data[key];
      }
    }

    // Extract style fields (strip "style." prefix)
    var style = {};
    for (var key2 in data) {
      if (key2.indexOf("style.") === 0 && data[key2]) {
        style[key2.replace("style.", "")] = data[key2];
      }
    }

    // Human-readable label
    var label = "";
    if (type === "url") label = content.url || "URL";
    else if (type === "text") label = content.text || "Text";
    else if (type === "wifi") label = content.ssid || "WiFi";
    else if (type === "vcard")
      label =
        [content.firstName, content.lastName].filter(Boolean).join(" ") ||
        "Contact";
    else if (type === "email") label = content.to || "Email";
    else if (type === "phone") label = content.phone || "Phone";
    else if (type === "sms") label = content.phone || "SMS";
    else if (type === "line") label = content.lineId || "LINE";
    else if (type === "facebook") label = content.facebookUrl || "Facebook";
    else if (type === "promptpay") label = content.promptpayId || "PromptPay";
    if (label.length > 50) label = label.substring(0, 50) + "...";

    // Build entry (thumbnail filled async below)
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      type: type,
      content: content,
      style: style,
      label: label,
      starred: false,
      createdAt: new Date().toISOString(),
      source: "generated",
      thumbnail: "",
    };

    // Helper: persist to localStorage with quota-exceeded fallback
    function persistEntry(thumbData) {
      entry.thumbnail = thumbData || "";
      try {
        var history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        history.unshift(entry);
        if (history.length > MAX_HISTORY) history.pop();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        updateHistoryBadges(history.length);
      } catch (storageErr) {
        console.error("localStorage save failed:", storageErr);
        // Quota exceeded? retry without thumbnail
        if (thumbData) {
          entry.thumbnail = "";
          try {
            var h2 = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            h2.unshift(entry);
            if (h2.length > MAX_HISTORY) h2.pop();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(h2));
            updateHistoryBadges(h2.length);
          } catch (e2) {
            console.error("Save without thumbnail also failed:", e2);
          }
        }
      }
    }

    // Get source data URL from preview
    var previewImg = document.querySelector("#qr-preview img");
    var srcDataUrl =
      previewImg && previewImg.src && previewImg.src.indexOf("data:") === 0
        ? previewImg.src
        : "";

    if (srcDataUrl) {
      // Draw into a small off-screen canvas -> tiny base64 thumbnail
      // Using new Image() ensures it works even in WKWebView
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = THUMB_SIZE;
          canvas.height = THUMB_SIZE;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
          ctx.drawImage(img, 0, 0, THUMB_SIZE, THUMB_SIZE);
          persistEntry(canvas.toDataURL("image/png", 0.6));
        } catch (canvasErr) {
          console.warn("Canvas thumbnail failed:", canvasErr);
          persistEntry("");
        }
      };
      img.onerror = function () {
        console.warn("Image load for thumbnail failed");
        persistEntry("");
      };
      img.src = srcDataUrl;
    } else {
      persistEntry("");
    }

    // Instant button feedback (don't wait for async thumbnail)
    showSaveButtonFeedback();
  } catch (e) {
    console.error("Failed to save to history", e);
  }
}

function showSaveButtonFeedback() {
  var saveBtn = document.getElementById("save-to-history-btn");
  if (!saveBtn) return;
  var originalHTML = saveBtn.innerHTML;
  saveBtn.innerHTML = "✅ " + (window.t ? window.t("saved") : "Saved!");
  saveBtn.classList.add("btn-success", "text-white");
  saveBtn.classList.remove("btn-ghost", "text-base-content/50");
  saveBtn.disabled = true;
  setTimeout(function () {
    saveBtn.innerHTML = originalHTML;
    saveBtn.classList.remove("btn-success", "text-white");
    saveBtn.classList.add("btn-ghost", "text-base-content/50");
    saveBtn.disabled = false;
  }, 2000);
}

function updateHistoryBadges(count) {
  ["history-badge", "history-badge-mobile"].forEach(function (id) {
    var el = document.getElementById(id);
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
      const openMenus = document.querySelectorAll(
        ".dropdown-menu-content:not(.hidden)",
      );
      openMenus.forEach((menu) => {
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

        if (targetContent) {
          targetContent.classList.remove("hidden");
        }
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
              if (qrResultContainer)
                qrResultContainer.classList.remove("hidden");
            }
          } else {
            console.error("Failed to generate QR Code");
          }
        } catch (error) {
          console.error("Error:", error);
        }
      });
    });
  };

  setupDropdowns();
  setupMobileMenu();
  setupTabs();
  setupForms();
});
